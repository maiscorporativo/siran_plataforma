import express from 'express';
import pool from '../../db.js';
import { txt, soDigitos, cnpjValido, configuracoes, like, paginacao, registrarAcao } from '../../lib/util.js';
import { encerrarSessoesDoUsuario } from '../../lib/auth.js';
import { enviarPrivado, removerArquivo } from '../../lib/storage.js';
import { criarTokenSenha } from '../../lib/senhas.js';
import { notificar, statusCanais, link } from '../../lib/notificacoes.js';
import { avisarVagaModerada, avisarEmpresaDecidida } from '../../lib/avisos.js';
import { CAMPOS_VAGA, JOIN_VAGA, EXPIRADA_SQL, statusExibidoVaga, CAMPOS_CANDIDATO } from '../vagas.js';

/* ═══════════════ Moderação de vagas ═══════════════ */
export const vagas = express.Router();

vagas.get('/', async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];
  if (q.status === 'expirada') where.push(`v.status = 'aprovada' AND ${EXPIRADA_SQL}`);
  else if (q.status === 'aprovada') where.push(`v.status = 'aprovada' AND NOT ${EXPIRADA_SQL}`);
  else if (['pendente', 'reprovada', 'pausada', 'encerrada'].includes(q.status)) { where.push('v.status = ?'); params.push(q.status); }
  if (['emprego', 'estagio', 'temporario'].includes(q.tipo)) { where.push('v.tipo = ?'); params.push(q.tipo); }
  if (q.q) { where.push('(v.titulo LIKE ? OR a.nome LIKE ? OR o.nome LIKE ?)'); params.push(like(q.q), like(q.q), like(q.q)); }
  const w = where.length ? where.join(' AND ') : '1=1';
  const { limite, offset, pagina, porPagina } = paginacao(q, 30);
  const [rows] = await pool.query(
    `SELECT ${CAMPOS_VAGA} FROM vagas v ${JOIN_VAGA} WHERE ${w}
      ORDER BY ${q.status === 'pendente' ? 'v.updated_at ASC' : 'v.updated_at DESC'} LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM vagas v ${JOIN_VAGA} WHERE ${w}`, params);
  res.json({ itens: rows.map(v => ({ ...v, status_exibido: statusExibidoVaga(v) })), total, pagina, por_pagina: porPagina });
});

vagas.get('/:id', async (req, res) => {
  const [[v]] = await pool.query(`SELECT ${CAMPOS_VAGA}, a.matricula FROM vagas v ${JOIN_VAGA} WHERE v.id = ?`, [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Vaga não encontrada.' });
  const [candidaturas] = await pool.query(
    `SELECT ca.id, ca.status, ca.created_at, k.nome, k.cidade FROM candidaturas ca JOIN candidatos k ON k.id = ca.candidato_id
      WHERE ca.vaga_id = ? ORDER BY ca.created_at DESC`, [v.id]);
  res.json({ ...v, status_exibido: statusExibidoVaga(v), lista_candidaturas: candidaturas });
});

vagas.post('/:id/moderar', async (req, res) => {
  const { decisao } = req.body;
  const motivo = txt(req.body.motivo, 255);
  const [[v]] = await pool.query('SELECT id, titulo FROM vagas WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Vaga não encontrada.' });
  if (decisao === 'aprovar') {
    const cfg = await configuracoes();
    const dias = Number(cfg.vaga_validade_dias) || 45;
    await pool.query(
      `UPDATE vagas SET status = 'aprovada', motivo_reprovacao = NULL, moderado_por = ?, publicado_em = NOW(),
              expira_em = NOW() + INTERVAL ? DAY WHERE id = ?`, [req.admin.id, dias, v.id]);
  } else if (decisao === 'reprovar') {
    if (!motivo) return res.status(400).json({ error: 'Informe o motivo para quem publicou corrigir a vaga.' });
    await pool.query("UPDATE vagas SET status = 'reprovada', motivo_reprovacao = ?, moderado_por = ? WHERE id = ?", [motivo, req.admin.id, v.id]);
  } else return res.status(400).json({ error: 'Decisão inválida.' });
  avisarVagaModerada(v.id, decisao, motivo);
  await registrarAcao(req.admin.id, `vaga:${decisao}`, 'vaga', v.id, motivo || v.titulo);
  res.json({ ok: true });
});

vagas.delete('/:id', async (req, res) => {
  const [r] = await pool.query('DELETE FROM vagas WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Vaga não encontrada.' });
  await registrarAcao(req.admin.id, 'excluir', 'vaga', Number(req.params.id));
  res.json({ ok: true });
});

/* ═══════════════ Empresas parceiras e instituições de ensino ═══════════════ */
export const organizacoes = express.Router();

organizacoes.get('/', async (req, res) => {
  const tipo = req.query.tipo === 'instituicao' ? 'instituicao' : 'empresa';
  const [rows] = await pool.query(
    `SELECT o.id, o.tipo, o.nome, o.cnpj, o.responsavel, o.email, o.telefone, o.whatsapp, o.cidade, o.uf, o.status, o.motivo_status,
            o.created_at, o.ultimo_login, (o.senha_hash IS NOT NULL) AS tem_senha,
            (SELECT COUNT(*) FROM vagas v WHERE v.organizacao_id = o.id) AS vagas,
            (SELECT COUNT(*) FROM candidatos k WHERE k.instituicao_id = o.id) AS estudantes,
            (SELECT COUNT(*) FROM candidatos k WHERE k.instituicao_id = o.id AND k.vinculo_status = 'pendente') AS estudantes_pendentes
       FROM organizacoes o WHERE o.tipo = ? ORDER BY o.status = 'pendente' DESC, o.nome`, [tipo]);
  res.json(rows);
});

function lerOrg(b) {
  return {
    nome: txt(b.nome, 160), cnpj: soDigitos(b.cnpj) || null, responsavel: txt(b.responsavel, 120), cargo: txt(b.cargo, 80),
    email: txt(b.email, 160)?.toLowerCase(), telefone: soDigitos(b.telefone) || null, whatsapp: soDigitos(b.whatsapp) || null,
    cidade: txt(b.cidade, 80), uf: txt(b.uf, 2)?.toUpperCase() || 'SP', site: txt(b.site, 200), descricao: txt(b.descricao, 3000),
  };
}

/* Envia o link para a organização criar a senha (convite) */
async function enviarConvite(o) {
  const canais = statusCanais();
  if (!canais.email || !canais.app_url) return false;
  const token = await criarTokenSenha(o.tipo, o.id, 72);
  const inst = o.tipo === 'instituicao';
  await notificar({
    evento: `convite_${o.tipo}`, para: { email: o.email }, essencial: true,
    titulo: inst ? 'Convite: plataforma de estágios do SIRAN' : 'Seu acesso à plataforma de vagas do SIRAN',
    paragrafos: inst
      ? [`Olá${o.responsavel ? `, ${o.responsavel.split(' ')[0]}` : ''}! O SIRAN – Sindicato Rural da Alta Noroeste convida ${o.nome} para a plataforma de vagas de emprego e estágio no agro.`,
        'Pela plataforma a instituição confirma a matrícula dos estudantes que se candidatam a estágios e acompanha as candidaturas deles.',
        'Toque no link abaixo para criar sua senha. Ele vale por 3 dias.']
      : [`Olá! ${o.nome} já pode publicar vagas na plataforma do SIRAN.`, 'Toque no link abaixo para criar sua senha. Ele vale por 3 dias.'],
    botao: { texto: 'Criar minha senha', url: link(`/conta/redefinir?tipo=${o.tipo}&t=${token}`) },
  });
  return true;
}

/* Cadastro feito pela equipe (instituições sempre entram assim) */
organizacoes.post('/', async (req, res) => {
  const tipo = req.body.tipo === 'instituicao' ? 'instituicao' : 'empresa';
  const d = lerOrg(req.body);
  if (!d.nome) return res.status(400).json({ error: 'Informe o nome.' });
  if (!d.email?.includes('@')) return res.status(400).json({ error: 'Informe o e-mail de quem vai acessar.' });
  if (d.cnpj && !cnpjValido(d.cnpj)) return res.status(400).json({ error: 'CNPJ inválido.' });
  try {
    const [r] = await pool.query('INSERT INTO organizacoes SET ?', [{ ...d, tipo, status: 'ativa' }]);
    const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [r.insertId]);
    const convite = req.body.enviar_convite !== false ? await enviarConvite(o) : false;
    await registrarAcao(req.admin.id, 'criar', tipo, o.id, d.nome);
    res.status(201).json({ id: o.id, convite_enviado: convite });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um cadastro com este e-mail.' });
    throw err;
  }
});

organizacoes.put('/:id', async (req, res) => {
  const d = lerOrg(req.body);
  if (!d.nome || !d.email?.includes('@')) return res.status(400).json({ error: 'Informe nome e e-mail.' });
  try {
    const [r] = await pool.query('UPDATE organizacoes SET ? WHERE id = ?', [d, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Cadastro não encontrado.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um cadastro com este e-mail.' });
    throw err;
  }
  res.json({ ok: true });
});

organizacoes.post('/:id/convite', async (req, res) => {
  const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [req.params.id]);
  if (!o) return res.status(404).json({ error: 'Cadastro não encontrado.' });
  if (!(await enviarConvite(o))) return res.status(400).json({ error: 'Envio de e-mail não configurado (SMTP e APP_URL).' });
  await registrarAcao(req.admin.id, 'convite', o.tipo, o.id, o.email);
  res.json({ ok: true, email: o.email });
});

/* Aprovar, recusar, suspender ou reativar */
organizacoes.post('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['ativa', 'recusada', 'suspensa'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
  const motivo = txt(req.body.motivo, 255);
  if (status !== 'ativa' && !motivo) return res.status(400).json({ error: 'Informe o motivo.' });
  const [[o]] = await pool.query('SELECT id, tipo, status FROM organizacoes WHERE id = ?', [req.params.id]);
  if (!o) return res.status(404).json({ error: 'Cadastro não encontrado.' });
  await pool.query('UPDATE organizacoes SET status = ?, motivo_status = ? WHERE id = ?', [status, status === 'ativa' ? null : motivo, o.id]);
  if (status !== 'ativa') {
    await encerrarSessoesDoUsuario(o.tipo, o.id);
    // Vagas da empresa saem do ar
    await pool.query("UPDATE vagas SET status = 'pausada' WHERE organizacao_id = ? AND status = 'aprovada'", [o.id]);
  }
  if (o.tipo === 'empresa' && o.status === 'pendente') avisarEmpresaDecidida(o.id);
  await registrarAcao(req.admin.id, `status:${status}`, o.tipo, o.id, motivo);
  res.json({ ok: true });
});

/* ═══════════════ Banco de candidatos ═══════════════ */
export const candidatos = express.Router();

candidatos.get('/', async (req, res) => {
  const q = req.query;
  const where = ['1=1'];
  const params = [];
  if (q.q) { where.push('(k.nome LIKE ? OR k.email LIKE ? OR k.cidade LIKE ? OR k.curso LIKE ?)'); params.push(like(q.q), like(q.q), like(q.q), like(q.q)); }
  if (q.estudantes === '1') where.push('k.estudante = 1');
  const { limite, offset, pagina, porPagina } = paginacao(q, 50);
  const w = where.join(' AND ');
  const [rows] = await pool.query(
    `SELECT k.id, k.nome, k.email, k.whatsapp, k.cidade, k.uf, k.escolaridade, k.estudante, k.curso, k.vinculo_status, k.created_at,
            (k.curriculo_arquivo IS NOT NULL) AS tem_curriculo, inst.nome AS instituicao,
            (SELECT COUNT(*) FROM candidaturas ca WHERE ca.candidato_id = k.id) AS candidaturas
       FROM candidatos k LEFT JOIN organizacoes inst ON inst.id = k.instituicao_id
      WHERE ${w} ORDER BY k.created_at DESC LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM candidatos k WHERE ${w}`, params);
  res.json({ itens: rows, total, pagina, por_pagina: porPagina });
});

candidatos.get('/:id', async (req, res) => {
  const [[k]] = await pool.query(
    `SELECT ${CAMPOS_CANDIDATO}, k.email, k.whatsapp, k.cpf, k.matricula, k.created_at FROM candidatos k
       LEFT JOIN organizacoes inst ON inst.id = k.instituicao_id WHERE k.id = ?`, [req.params.id]);
  if (!k) return res.status(404).json({ error: 'Candidato não encontrado.' });
  const [lista] = await pool.query(
    `SELECT ca.status, ca.created_at, v.id AS vaga_id, v.titulo, v.tipo FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id
      WHERE ca.candidato_id = ? ORDER BY ca.created_at DESC`, [k.candidato_id]);
  res.json({ candidato: k, candidaturas: lista });
});

candidatos.get('/:id/curriculo', async (req, res) => {
  const [[k]] = await pool.query('SELECT curriculo_arquivo, nome FROM candidatos WHERE id = ?', [req.params.id]);
  if (!k?.curriculo_arquivo) return res.status(404).json({ error: 'Currículo não disponível.' });
  enviarPrivado(res, k.curriculo_arquivo, `curriculo-${k.nome.split(' ')[0].toLowerCase()}.pdf`);
});

/* Exclusão a pedido do titular (LGPD) */
candidatos.delete('/:id', async (req, res) => {
  const [[k]] = await pool.query('SELECT curriculo_arquivo, nome FROM candidatos WHERE id = ?', [req.params.id]);
  if (!k) return res.status(404).json({ error: 'Candidato não encontrado.' });
  await pool.query('DELETE FROM candidatos WHERE id = ?', [req.params.id]);
  await encerrarSessoesDoUsuario('candidato', Number(req.params.id));
  removerArquivo(k.curriculo_arquivo, true);
  await registrarAcao(req.admin.id, 'excluir', 'candidato', Number(req.params.id), k.nome);
  res.json({ ok: true });
});
