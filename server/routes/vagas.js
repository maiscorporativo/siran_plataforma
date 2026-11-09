import express from 'express';
import pool from '../db.js';
import { requireCandidato, requireOfertante } from '../lib/auth.js';
import { txt, num, like, configuracoes, paginacao } from '../lib/util.js';
import { enviarPrivado } from '../lib/storage.js';
import { avisarEquipe, avisarNovaCandidatura, avisarCandidaturaStatus } from '../lib/avisos.js';

export const TIPOS_VAGA = ['emprego', 'estagio', 'temporario'];
export const AREAS_VAGA = [
  'Pecuária de corte', 'Pecuária de leite', 'Agricultura', 'Operação de máquinas', 'Manutenção e mecânica',
  'Veterinária e zootecnia', 'Agronomia', 'Administração e escritório', 'Serviços gerais', 'Outros',
];
export const EXPIRADA_SQL = '(v.expira_em IS NOT NULL AND v.expira_em <= NOW())';

/* Nome de quem oferece a vaga (respeita "exibir nome") */
export const CAMPOS_VAGA = `v.*, ${EXPIRADA_SQL} AS expirada,
  COALESCE(a.nome, o.nome) AS ofertante_nome, IF(v.associado_id IS NOT NULL, 'associado', 'empresa') AS ofertante_tipo,
  (SELECT COUNT(*) FROM candidaturas ca WHERE ca.vaga_id = v.id AND ca.status <> 'desistiu') AS candidaturas`;
export const JOIN_VAGA = 'LEFT JOIN associados a ON a.id = v.associado_id LEFT JOIN organizacoes o ON o.id = v.organizacao_id';

export function statusExibidoVaga(v) {
  return v.status === 'aprovada' && Number(v.expirada) ? 'expirada' : v.status;
}

/* Versão pública: sem dados internos e com o nome conforme a preferência do anunciante */
function vagaPublica(v) {
  const nome = v.exibir_nome ? v.ofertante_nome
    : v.ofertante_tipo === 'associado' ? 'Produtor rural associado ao SIRAN' : 'Empresa parceira do SIRAN';
  const { associado_id, organizacao_id, moderado_por, motivo_reprovacao, ofertante_nome, ...resto } = v;
  return { ...resto, ofertante: nome, candidaturas: undefined };
}

/* ═══════════════ Público + candidato ═══════════════ */
export const publico = express.Router();

publico.get('/', async (req, res) => {
  const q = req.query;
  const where = ["v.status = 'aprovada'", `NOT ${EXPIRADA_SQL}`];
  const params = [];
  if (TIPOS_VAGA.includes(q.tipo)) { where.push('v.tipo = ?'); params.push(q.tipo); }
  if (q.area) { where.push('v.area = ?'); params.push(q.area); }
  if (q.cidade) { where.push('v.cidade = ?'); params.push(q.cidade); }
  if (q.q) { where.push('(v.titulo LIKE ? OR v.descricao LIKE ? OR v.estagio_cursos LIKE ?)'); params.push(like(q.q), like(q.q), like(q.q)); }
  const { limite, offset, pagina, porPagina } = paginacao(q, 30);
  const w = where.join(' AND ');
  const [rows] = await pool.query(
    `SELECT ${CAMPOS_VAGA} FROM vagas v ${JOIN_VAGA} WHERE ${w} ORDER BY v.publicado_em DESC LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM vagas v WHERE ${w}`, params);
  const [cidades] = await pool.query(`SELECT DISTINCT v.cidade FROM vagas v WHERE v.status = 'aprovada' AND NOT ${EXPIRADA_SQL} AND v.cidade IS NOT NULL ORDER BY v.cidade`);
  res.json({ itens: rows.map(vagaPublica), total, pagina, por_pagina: porPagina, cidades: cidades.map(c => c.cidade), areas: AREAS_VAGA });
});

publico.get('/:id', async (req, res) => {
  const [[v]] = await pool.query(`SELECT ${CAMPOS_VAGA} FROM vagas v ${JOIN_VAGA} WHERE v.id = ?`, [req.params.id]);
  if (!v || statusExibidoVaga(v) !== 'aprovada') return res.status(404).json({ error: 'Vaga não encontrada ou encerrada.' });
  res.json(vagaPublica(v));
});

/* ── POST /api/vagas/:id/candidatar ── */
publico.post('/:id/candidatar', requireCandidato, async (req, res) => {
  const c = req.candidato;
  const [[v]] = await pool.query(`SELECT v.*, ${EXPIRADA_SQL} AS expirada FROM vagas v WHERE v.id = ?`, [req.params.id]);
  if (!v || statusExibidoVaga(v) !== 'aprovada') return res.status(404).json({ error: 'Vaga não encontrada ou encerrada.' });
  if (v.tipo === 'estagio' && (!c.estudante || !c.instituicao_id || !c.curso)) {
    return res.status(400).json({ error: 'Vagas de estágio são para estudantes. Informe sua instituição de ensino e curso no seu perfil antes de se candidatar.' });
  }
  if (!c.resumo && !c.experiencias && !c.curriculo_arquivo) {
    return res.status(400).json({ error: 'Complete seu currículo (resumo, experiências ou PDF) antes de se candidatar.' });
  }
  const [[ja]] = await pool.query('SELECT id, status FROM candidaturas WHERE vaga_id = ? AND candidato_id = ?', [v.id, c.id]);
  if (ja && ja.status !== 'desistiu') return res.status(409).json({ error: 'Você já se candidatou a esta vaga.' });
  const mensagem = txt(req.body.mensagem, 2000);
  let id = ja?.id;
  if (ja) await pool.query("UPDATE candidaturas SET status = 'enviada', mensagem = ?, created_at = NOW() WHERE id = ?", [mensagem, ja.id]);
  else [{ insertId: id }] = await pool.query('INSERT INTO candidaturas (vaga_id, candidato_id, mensagem) VALUES (?, ?, ?)', [v.id, c.id, mensagem]);
  avisarNovaCandidatura(id);
  res.status(201).json({ id });
});

/* ═══════════════ Quem publica (associado ou empresa parceira) ═══════════════ */
export const ofertante = express.Router();
ofertante.use(requireOfertante);

const dono = req => (req.ofertante.tipo === 'associado' ? ['v.associado_id = ?', req.ofertante.id] : ['v.organizacao_id = ?', req.ofertante.id]);

function lerVaga(b) {
  const tipo = TIPOS_VAGA.includes(b.tipo) ? b.tipo : 'emprego';
  const qtd = num(b.quantidade);
  return {
    tipo,
    titulo: txt(b.titulo, 160),
    area: AREAS_VAGA.includes(b.area) ? b.area : 'Outros',
    descricao: txt(b.descricao, 6000),
    requisitos: txt(b.requisitos, 3000),
    beneficios: txt(b.beneficios, 2000),
    remuneracao: txt(b.remuneracao, 160),
    jornada: txt(b.jornada, 160),
    quantidade: qtd && qtd > 0 ? Math.min(Math.round(qtd), 999) : 1,
    cidade: txt(b.cidade, 80),
    uf: txt(b.uf, 2)?.toUpperCase() || 'SP',
    estagio_nivel: tipo === 'estagio' && ['medio_tecnico', 'superior', 'ambos'].includes(b.estagio_nivel) ? b.estagio_nivel : null,
    estagio_cursos: tipo === 'estagio' ? txt(b.estagio_cursos, 255) : null,
    exibir_nome: b.exibir_nome === false || b.exibir_nome === 'false' ? 0 : 1,
  };
}

function validarVaga(d) {
  if (!d.titulo || d.titulo.length < 5) return 'Informe um título para a vaga.';
  if (!d.descricao || d.descricao.length < 30) return 'Descreva as atividades da vaga (pelo menos 30 caracteres).';
  if (!d.cidade) return 'Informe a cidade de trabalho.';
  if (d.tipo === 'estagio' && !d.estagio_nivel) return 'Informe o nível do estágio (médio/técnico ou superior).';
  return null;
}

ofertante.get('/vagas', async (req, res) => {
  const [w, p] = dono(req);
  const [rows] = await pool.query(`SELECT ${CAMPOS_VAGA} FROM vagas v ${JOIN_VAGA} WHERE ${w} ORDER BY v.updated_at DESC`, [p]);
  res.json({ itens: rows.map(v => ({ ...v, status_exibido: statusExibidoVaga(v) })), ofertante: req.ofertante, areas: AREAS_VAGA });
});

ofertante.get('/vagas/:id', async (req, res) => {
  const [w, p] = dono(req);
  const [[v]] = await pool.query(`SELECT ${CAMPOS_VAGA} FROM vagas v ${JOIN_VAGA} WHERE v.id = ? AND ${w}`, [req.params.id, p]);
  if (!v) return res.status(404).json({ error: 'Vaga não encontrada.' });
  res.json({ ...v, status_exibido: statusExibidoVaga(v), areas: AREAS_VAGA });
});

ofertante.post('/vagas', async (req, res) => {
  const d = lerVaga(req.body);
  const erro = validarVaga(d);
  if (erro) return res.status(400).json({ error: erro });
  const [r] = await pool.query('INSERT INTO vagas SET ?', [{
    ...d, status: 'pendente',
    associado_id: req.ofertante.tipo === 'associado' ? req.ofertante.id : null,
    organizacao_id: req.ofertante.tipo === 'empresa' ? req.ofertante.id : null,
  }]);
  avisarEquipe('equipe_vaga', 'Nova vaga para moderar', [`${req.ofertante.nome} enviou a vaga "${d.titulo}".`], '/admin/vagas');
  res.status(201).json({ id: r.insertId });
});

ofertante.put('/vagas/:id', async (req, res) => {
  const [w, p] = dono(req);
  const d = lerVaga(req.body);
  const erro = validarVaga(d);
  if (erro) return res.status(400).json({ error: erro });
  const [r] = await pool.query(`UPDATE vagas v SET ?, status = 'pendente', motivo_reprovacao = NULL WHERE v.id = ? AND ${w} AND v.status <> 'encerrada'`, [d, req.params.id, p]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Vaga não encontrada ou já encerrada.' });
  avisarEquipe('equipe_vaga', 'Vaga editada para moderar', [`${req.ofertante.nome} editou a vaga "${d.titulo}".`], '/admin/vagas');
  res.json({ ok: true });
});

ofertante.post('/vagas/:id/acao', async (req, res) => {
  const [w, p] = dono(req);
  const [[v]] = await pool.query(`SELECT v.*, ${EXPIRADA_SQL} AS expirada FROM vagas v WHERE v.id = ? AND ${w}`, [req.params.id, p]);
  if (!v) return res.status(404).json({ error: 'Vaga não encontrada.' });
  const cfg = await configuracoes();
  const dias = Number(cfg.vaga_validade_dias) || 45;
  const exibido = statusExibidoVaga(v);
  switch (req.body.acao) {
    case 'pausar':
      if (exibido !== 'aprovada') return res.status(400).json({ error: 'Só vagas publicadas podem ser pausadas.' });
      await pool.query("UPDATE vagas SET status = 'pausada' WHERE id = ?", [v.id]); break;
    case 'reativar':
      if (v.status !== 'pausada') return res.status(400).json({ error: 'Esta vaga não está pausada.' });
      await pool.query("UPDATE vagas SET status = 'aprovada', expira_em = GREATEST(COALESCE(expira_em, NOW()), NOW() + INTERVAL 7 DAY) WHERE id = ?", [v.id]); break;
    case 'renovar':
      if (exibido !== 'expirada') return res.status(400).json({ error: 'Só vagas expiradas podem ser renovadas.' });
      await pool.query('UPDATE vagas SET expira_em = NOW() + INTERVAL ? DAY WHERE id = ?', [dias, v.id]); break;
    case 'encerrar':
      await pool.query("UPDATE vagas SET status = 'encerrada' WHERE id = ?", [v.id]); break;
    default:
      return res.status(400).json({ error: 'Ação inválida.' });
  }
  res.json({ ok: true });
});

ofertante.delete('/vagas/:id', async (req, res) => {
  const [w, p] = dono(req);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM candidaturas WHERE vaga_id = ?', [req.params.id]);
  if (n > 0) return res.status(400).json({ error: 'Esta vaga já recebeu candidaturas. Encerre a vaga em vez de excluir.' });
  const [r] = await pool.query(`DELETE v FROM vagas v WHERE v.id = ? AND ${w}`, [req.params.id, p]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Vaga não encontrada.' });
  res.json({ ok: true });
});

/* ── Candidaturas recebidas em uma vaga ── */
export const CAMPOS_CANDIDATO = `k.id AS candidato_id, k.nome, k.cidade, k.uf, k.data_nascimento, k.escolaridade, k.areas_interesse,
  k.resumo, k.experiencias, k.cnh, k.disponibilidade, (k.curriculo_arquivo IS NOT NULL) AS tem_curriculo,
  k.estudante, k.curso, k.periodo, k.previsao_conclusao, k.vinculo_status, inst.nome AS instituicao`;

ofertante.get('/vagas/:id/candidaturas', async (req, res) => {
  const [w, p] = dono(req);
  const [[v]] = await pool.query(`SELECT v.id, v.titulo, v.tipo FROM vagas v WHERE v.id = ? AND ${w}`, [req.params.id, p]);
  if (!v) return res.status(404).json({ error: 'Vaga não encontrada.' });
  const [rows] = await pool.query(
    `SELECT ca.id, ca.status, ca.mensagem, ca.created_at, ${CAMPOS_CANDIDATO},
            -- contato só aparece depois que o candidato é chamado para entrevista ou aprovado
            IF(ca.status IN ('entrevista','aprovada'), k.whatsapp, NULL) AS whatsapp,
            IF(ca.status IN ('entrevista','aprovada'), k.email, NULL) AS email
       FROM candidaturas ca JOIN candidatos k ON k.id = ca.candidato_id
       LEFT JOIN organizacoes inst ON inst.id = k.instituicao_id
      WHERE ca.vaga_id = ? AND ca.status <> 'desistiu' ORDER BY ca.created_at DESC`, [v.id]);
  res.json({ vaga: v, candidaturas: rows });
});

ofertante.post('/candidaturas/:id/status', async (req, res) => {
  const status = req.body.status;
  if (!['em_analise', 'entrevista', 'aprovada', 'nao_selecionada'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
  const [w, p] = dono(req);
  const [r] = await pool.query(
    `UPDATE candidaturas ca JOIN vagas v ON v.id = ca.vaga_id SET ca.status = ? WHERE ca.id = ? AND ${w} AND ca.status <> 'desistiu'`,
    [status, req.params.id, p]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Candidatura não encontrada.' });
  avisarCandidaturaStatus(Number(req.params.id));
  res.json({ ok: true });
});

ofertante.get('/candidaturas/:id/curriculo', async (req, res) => {
  const [w, p] = dono(req);
  const [[k]] = await pool.query(
    `SELECT k.curriculo_arquivo, k.nome FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id JOIN candidatos k ON k.id = ca.candidato_id
      WHERE ca.id = ? AND ${w}`, [req.params.id, p]);
  if (!k?.curriculo_arquivo) return res.status(404).json({ error: 'Currículo não disponível.' });
  enviarPrivado(res, k.curriculo_arquivo, `curriculo-${k.nome.split(' ')[0].toLowerCase()}.pdf`);
});
