import express from 'express';
import pool, { transaction } from '../../db.js';
import { uploadImagemCurso, removerArquivo } from '../../lib/storage.js';
import { txt, num, dataISO, soDigitos, cpfValido, like, registrarAcao } from '../../lib/util.js';
import { descartarUploads } from '../../lib/associado.js';
import { CAMPOS_CURSO, situacaoCurso, promoverEspera, inscrever } from '../cursos.js';
import { avisarInscricao } from '../../lib/avisos.js';

const router = express.Router();

function ler(b) {
  const vagas = num(b.vagas);
  const carga = num(b.carga_horaria);
  return {
    tipo: b.tipo === 'evento' ? 'evento' : 'curso',
    titulo: txt(b.titulo, 200),
    resumo: txt(b.resumo, 500),
    descricao: txt(b.descricao, 20000),
    categoria: txt(b.categoria, 60),
    realizacao: txt(b.realizacao, 120),
    instrutor: txt(b.instrutor, 120),
    cidade: txt(b.cidade, 80),
    local: txt(b.local, 200),
    data_inicio: dataISO(b.data_inicio),
    data_fim: dataISO(b.data_fim),
    horario: txt(b.horario, 120),
    carga_horaria: carga && carga > 0 ? Math.round(carga) : null,
    vagas: vagas && vagas > 0 ? Math.round(vagas) : null,
    publico: b.publico === 'associados' ? 'associados' : 'todos',
    inscricoes_ate: dataISO(b.inscricoes_ate),
    status: ['rascunho', 'publicado'].includes(b.status) ? b.status : 'publicado',
  };
}

function validar(d) {
  if (!d.titulo) return 'Informe o título.';
  if (!d.data_inicio) return 'Informe a data de início.';
  if (d.data_fim && d.data_fim < d.data_inicio) return 'A data de término é anterior ao início.';
  return null;
}

/* ── GET /api/admin/cursos ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = ['1=1'];
  const params = [];
  if (q.periodo === 'anteriores') where.push('COALESCE(c.data_fim, c.data_inicio) < CURDATE()');
  else if (q.periodo !== 'todos') where.push('COALESCE(c.data_fim, c.data_inicio) >= CURDATE()');
  if (q.q) { where.push('(c.titulo LIKE ? OR c.cidade LIKE ?)'); params.push(like(q.q), like(q.q)); }
  const [rows] = await pool.query(
    `SELECT ${CAMPOS_CURSO} FROM cursos c WHERE ${where.join(' AND ')}
      ORDER BY ${q.periodo === 'anteriores' ? 'c.data_inicio DESC' : 'c.data_inicio ASC'} LIMIT 300`, params);
  res.json(rows.map(situacaoCurso));
});

router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query(`SELECT ${CAMPOS_CURSO} FROM cursos c WHERE c.id = ?`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Curso não encontrado.' });
  const [inscritos] = await pool.query(
    `SELECT i.id, i.nome, i.cpf, i.telefone, i.email, i.cidade, i.status, i.presente, i.created_at, i.associado_id, a.matricula
       FROM inscricoes i LEFT JOIN associados a ON a.id = i.associado_id
      WHERE i.curso_id = ? ORDER BY FIELD(i.status, 'confirmada', 'espera', 'cancelada'), i.created_at, i.id`, [c.id]);
  res.json({ curso: situacaoCurso(c), inscritos });
});

/* ── Planilha de inscritos ── */
router.get('/:id/exportar', async (req, res) => {
  const [[c]] = await pool.query('SELECT titulo, data_inicio FROM cursos WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Curso não encontrado.' });
  const [rows] = await pool.query(
    `SELECT i.nome, i.cpf, i.telefone, i.email, i.cidade, a.matricula, i.status, i.presente, i.created_at
       FROM inscricoes i LEFT JOIN associados a ON a.id = i.associado_id WHERE i.curso_id = ? ORDER BY i.status, i.nome`, [req.params.id]);
  const cab = ['nome', 'cpf', 'telefone', 'email', 'cidade', 'matricula', 'status', 'presente', 'created_at'];
  const esc = v => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);
  const csv = '﻿' + [cab.join(';'), ...rows.map(r => cab.map(k => esc(k === 'presente' ? (r[k] === null ? '' : r[k] ? 'sim' : 'não') : r[k])).join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inscritos-${c.data_inicio}.csv"`);
  res.send(csv);
});

router.post('/', uploadImagemCurso.single('imagem'), async (req, res) => {
  const d = ler(req.body);
  const erro = validar(d);
  if (erro) { descartarUploads(req); return res.status(400).json({ error: erro }); }
  if (req.file) d.imagem = `cursos/${req.file.filename}`;
  const [r] = await pool.query('INSERT INTO cursos SET ?', [{ ...d, created_by: req.admin.id }]);
  await registrarAcao(req.admin.id, 'criar', 'curso', r.insertId, d.titulo);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', uploadImagemCurso.single('imagem'), async (req, res) => {
  const [[atual]] = await pool.query('SELECT imagem, vagas, status FROM cursos WHERE id = ?', [req.params.id]);
  if (!atual) { descartarUploads(req); return res.status(404).json({ error: 'Curso não encontrado.' }); }
  const d = ler(req.body);
  const erro = validar(d);
  if (erro) { descartarUploads(req); return res.status(400).json({ error: erro }); }
  if (atual.status === 'cancelado') d.status = 'cancelado';
  const trocar = req.file || req.body.remover_imagem === 'true';
  if (req.file) d.imagem = `cursos/${req.file.filename}`;
  else if (req.body.remover_imagem === 'true') d.imagem = null;
  // Se aumentou as vagas, confirma quem está na lista de espera
  const promovidos = await transaction(async conn => {
    await conn.query('UPDATE cursos SET ? WHERE id = ?', [d, req.params.id]);
    const ids = [];
    for (;;) {
      const id = await promoverEspera(conn, Number(req.params.id));
      if (!id) break;
      ids.push(id);
    }
    return ids;
  });
  if (trocar) removerArquivo(atual.imagem);
  promovidos.forEach(id => avisarInscricao(id, 'promovida'));
  await registrarAcao(req.admin.id, 'editar', 'curso', Number(req.params.id), d.titulo);
  res.json({ ok: true, promovidos: promovidos.length });
});

/* ── Cancelar o curso e avisar todos os inscritos ── */
router.post('/:id/cancelar', async (req, res) => {
  const [[c]] = await pool.query('SELECT id, titulo, status FROM cursos WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Curso não encontrado.' });
  if (c.status === 'cancelado') return res.json({ ok: true });
  await pool.query("UPDATE cursos SET status = 'cancelado' WHERE id = ?", [c.id]);
  const [ins] = await pool.query("SELECT id FROM inscricoes WHERE curso_id = ? AND status IN ('confirmada','espera')", [c.id]);
  ins.forEach(i => avisarInscricao(i.id, 'curso_cancelado'));
  await registrarAcao(req.admin.id, 'cancelar', 'curso', c.id, c.titulo);
  res.json({ ok: true, avisados: ins.length });
});

router.delete('/:id', async (req, res) => {
  const [[c]] = await pool.query(
    "SELECT imagem, titulo, (SELECT COUNT(*) FROM inscricoes WHERE curso_id = cursos.id AND status <> 'cancelada') AS ativos FROM cursos WHERE id = ?", [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Curso não encontrado.' });
  if (c.ativos > 0) return res.status(400).json({ error: 'Há inscritos neste curso. Cancele o curso (os inscritos são avisados) em vez de excluir.' });
  await pool.query('DELETE FROM cursos WHERE id = ?', [req.params.id]);
  removerArquivo(c.imagem);
  await registrarAcao(req.admin.id, 'excluir', 'curso', Number(req.params.id), c.titulo);
  res.json({ ok: true });
});

/* ── Inscrição feita pela equipe (presencial/telefone) — ignora prazo e público ── */
router.post('/:id/inscricoes', async (req, res) => {
  const b = req.body;
  let dados;
  if (b.associado_id) {
    const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [b.associado_id]);
    if (!a) return res.status(404).json({ error: 'Associado não encontrado.' });
    dados = { associado_id: a.id, nome: a.nome, cpf: a.tipo_pessoa === 'PF' ? a.cpf_cnpj : soDigitos(b.cpf), telefone: a.whatsapp || a.telefone, email: a.email, cidade: a.cidade };
    if (a.tipo_pessoa === 'PJ') dados.nome = txt(b.nome, 160) || a.nome;
  } else {
    dados = { nome: txt(b.nome, 160), cpf: soDigitos(b.cpf), telefone: soDigitos(b.telefone) || null, email: txt(b.email, 160)?.toLowerCase() || null, cidade: txt(b.cidade, 80) };
  }
  if (!dados.nome) return res.status(400).json({ error: 'Informe o nome.' });
  if (!cpfValido(dados.cpf)) return res.status(400).json({ error: 'CPF inválido.' });
  if (!dados.associado_id) {
    // CPF de associado: vincula ao cadastro (aparece em "Minhas inscrições")
    const [[a]] = await pool.query("SELECT id FROM associados WHERE cpf_cnpj = ? AND status = 'ativo'", [dados.cpf]);
    if (a) dados.associado_id = a.id;
  }
  try {
    const r = await inscrever(Number(req.params.id), { ...dados, forcar: true });
    avisarInscricao(r.id, r.status === 'espera' ? 'espera' : 'confirmada');
    await registrarAcao(req.admin.id, 'inscrever', 'curso', Number(req.params.id), dados.nome);
    res.status(201).json(r);
  } catch (err) {
    if (err.codigo) return res.status(409).json({ error: err.message });
    throw err;
  }
});

router.post('/inscricoes/:id/presenca', async (req, res) => {
  const presente = req.body.presente === null ? null : req.body.presente ? 1 : 0;
  const [r] = await pool.query("UPDATE inscricoes SET presente = ? WHERE id = ? AND status = 'confirmada'", [presente, req.params.id]);
  if (!r.affectedRows) return res.status(400).json({ error: 'Só inscrições confirmadas recebem presença.' });
  res.json({ ok: true });
});

router.post('/inscricoes/:id/cancelar', async (req, res) => {
  const [[i]] = await pool.query('SELECT id, curso_id, status, nome FROM inscricoes WHERE id = ?', [req.params.id]);
  if (!i) return res.status(404).json({ error: 'Inscrição não encontrada.' });
  const promovido = await transaction(async conn => {
    await conn.query('SELECT id FROM cursos WHERE id = ? FOR UPDATE', [i.curso_id]);
    await conn.query("UPDATE inscricoes SET status = 'cancelada' WHERE id = ?", [i.id]);
    return i.status === 'confirmada' ? promoverEspera(conn, i.curso_id) : null;
  });
  if (promovido) avisarInscricao(promovido, 'promovida');
  await registrarAcao(req.admin.id, 'cancelar_inscricao', 'curso', i.curso_id, i.nome);
  res.json({ ok: true, promovido: !!promovido });
});

export default router;
