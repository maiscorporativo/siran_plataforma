import express from 'express';
import pool from '../db.js';
import { requireCandidato, requireOrganizacao } from '../lib/auth.js';
import { uploadCurriculo, enviarPrivado, removerArquivo } from '../lib/storage.js';
import { txt, soDigitos, dataISO, bool } from '../lib/util.js';
import { descartarUploads } from '../lib/associado.js';
import { avisarInstituicaoVinculo, avisarVinculoDecidido } from '../lib/avisos.js';
import { publicoConta } from './contas.js';
import { CAMPOS_CANDIDATO } from './vagas.js';

const ESCOLARIDADES = ['fundamental', 'medio', 'tecnico', 'superior', 'pos'];

/* ═══════════════ Candidato ═══════════════ */
export const candidato = express.Router();
candidato.use(requireCandidato);

candidato.put('/perfil', async (req, res) => {
  const b = req.body;
  const c = req.candidato;
  // Só altera o que veio na requisição — campo ausente mantém o valor atual
  const leitores = {
    nome: v => txt(v, 160) || c.nome,
    whatsapp: v => soDigitos(v) || null,
    cidade: v => txt(v, 80),
    uf: v => txt(v, 2)?.toUpperCase() || 'SP',
    data_nascimento: dataISO,
    escolaridade: v => (ESCOLARIDADES.includes(v) ? v : null),
    areas_interesse: v => txt(v, 255),
    resumo: v => txt(v, 3000),
    experiencias: v => txt(v, 6000),
    cnh: v => txt(v, 10)?.toUpperCase() || null,
    disponibilidade: v => txt(v, 160),
    aceita_whatsapp: bool,
    aceita_email: bool,
  };
  const d = {};
  for (const [campo, ler] of Object.entries(leitores)) if (b[campo] !== undefined) d[campo] = ler(b[campo]);
  if (b.estudante === undefined) {
    if (Object.keys(d).length) await pool.query('UPDATE candidatos SET ? WHERE id = ?', [d, c.id]);
    const [[novo]] = await pool.query('SELECT * FROM candidatos WHERE id = ?', [c.id]);
    return res.json({ conta: publicoConta('candidato', novo) });
  }
  d.estudante = bool(b.estudante);
  if (d.estudante) {
    const instId = Number(b.instituicao_id) || null;
    if (instId) {
      const [[inst]] = await pool.query("SELECT id FROM organizacoes WHERE id = ? AND tipo = 'instituicao' AND status = 'ativa'", [instId]);
      if (!inst) return res.status(400).json({ error: 'Instituição de ensino inválida.' });
    }
    Object.assign(d, {
      instituicao_id: instId, curso: txt(b.curso, 120), periodo: txt(b.periodo, 40), matricula: txt(b.matricula, 40),
      previsao_conclusao: /^\d{4}-\d{2}$/.test(b.previsao_conclusao || '') ? b.previsao_conclusao : null,
    });
    // Mudou instituição, curso ou matrícula: volta para confirmação da instituição
    const mudou = d.instituicao_id !== c.instituicao_id || d.curso !== c.curso || d.matricula !== c.matricula;
    if (mudou || c.vinculo_status === 'nao_informado') {
      d.vinculo_status = d.instituicao_id ? 'pendente' : 'nao_informado';
      d.vinculo_em = null;
    }
  } else {
    Object.assign(d, { instituicao_id: null, curso: null, periodo: null, matricula: null, previsao_conclusao: null, vinculo_status: 'nao_informado', vinculo_em: null });
  }
  await pool.query('UPDATE candidatos SET ? WHERE id = ?', [d, c.id]);
  if (d.vinculo_status === 'pendente' && c.vinculo_status !== 'pendente') avisarInstituicaoVinculo(c.id);
  const [[novo]] = await pool.query('SELECT * FROM candidatos WHERE id = ?', [c.id]);
  res.json({ conta: publicoConta('candidato', novo) });
});

candidato.post('/curriculo', uploadCurriculo.single('curriculo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie o currículo em PDF.' });
  const antigo = req.candidato.curriculo_arquivo;
  try {
    await pool.query('UPDATE candidatos SET curriculo_arquivo = ? WHERE id = ?', [`curriculos/${req.file.filename}`, req.candidato.id]);
  } catch (err) { descartarUploads(req); throw err; }
  removerArquivo(antigo, true);
  res.json({ ok: true });
});

candidato.get('/curriculo', (req, res) => {
  if (!req.candidato.curriculo_arquivo) return res.status(404).json({ error: 'Nenhum currículo enviado.' });
  enviarPrivado(res, req.candidato.curriculo_arquivo, 'meu-curriculo.pdf');
});

candidato.delete('/curriculo', async (req, res) => {
  await pool.query('UPDATE candidatos SET curriculo_arquivo = NULL WHERE id = ?', [req.candidato.id]);
  removerArquivo(req.candidato.curriculo_arquivo, true);
  res.json({ ok: true });
});

candidato.get('/candidaturas', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ca.id, ca.status, ca.created_at, ca.updated_at, v.id AS vaga_id, v.titulo, v.tipo, v.cidade, v.uf, v.status AS vaga_status,
            IF(v.exibir_nome, COALESCE(a.nome, o.nome), IF(v.associado_id IS NOT NULL, 'Produtor rural associado ao SIRAN', 'Empresa parceira do SIRAN')) AS ofertante
       FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id
       LEFT JOIN associados a ON a.id = v.associado_id LEFT JOIN organizacoes o ON o.id = v.organizacao_id
      WHERE ca.candidato_id = ? ORDER BY ca.updated_at DESC`, [req.candidato.id]);
  res.json(rows);
});

candidato.post('/candidaturas/:id/desistir', async (req, res) => {
  const [r] = await pool.query("UPDATE candidaturas SET status = 'desistiu' WHERE id = ? AND candidato_id = ?", [req.params.id, req.candidato.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Candidatura não encontrada.' });
  res.json({ ok: true });
});

/* ═══════════════ Instituição de ensino ═══════════════ */
export const instituicao = express.Router();
instituicao.use(requireOrganizacao('instituicao'));

instituicao.get('/estudantes', async (req, res) => {
  const status = ['pendente', 'confirmado', 'recusado'].includes(req.query.status) ? req.query.status : null;
  const [rows] = await pool.query(
    `SELECT k.id, k.nome, k.email, k.whatsapp, k.cidade, k.curso, k.periodo, k.matricula, k.previsao_conclusao, k.vinculo_status, k.vinculo_em, k.created_at,
            (SELECT COUNT(*) FROM candidaturas ca WHERE ca.candidato_id = k.id AND ca.status <> 'desistiu') AS candidaturas
       FROM candidatos k WHERE k.instituicao_id = ? AND k.estudante = 1 ${status ? 'AND k.vinculo_status = ?' : ''}
      ORDER BY k.vinculo_status = 'pendente' DESC, k.nome`, status ? [req.organizacao.id, status] : [req.organizacao.id]);
  res.json(rows);
});

instituicao.post('/estudantes/:id/vinculo', async (req, res) => {
  const decisao = req.body.decisao;
  if (!['confirmado', 'recusado'].includes(decisao)) return res.status(400).json({ error: 'Decisão inválida.' });
  const [r] = await pool.query('UPDATE candidatos SET vinculo_status = ?, vinculo_em = NOW() WHERE id = ? AND instituicao_id = ?',
    [decisao, req.params.id, req.organizacao.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Estudante não encontrado.' });
  avisarVinculoDecidido(Number(req.params.id));
  res.json({ ok: true });
});

instituicao.get('/estudantes/:id', async (req, res) => {
  const [[k]] = await pool.query(
    `SELECT ${CAMPOS_CANDIDATO}, k.email, k.whatsapp, k.matricula FROM candidatos k LEFT JOIN organizacoes inst ON inst.id = k.instituicao_id
      WHERE k.id = ? AND k.instituicao_id = ?`, [req.params.id, req.organizacao.id]);
  if (!k) return res.status(404).json({ error: 'Estudante não encontrado.' });
  const [candidaturas] = await pool.query(
    `SELECT ca.status, ca.created_at, v.titulo, v.tipo, v.cidade FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id
      WHERE ca.candidato_id = ? ORDER BY ca.created_at DESC`, [k.candidato_id]);
  res.json({ estudante: k, candidaturas });
});

instituicao.get('/estudantes/:id/curriculo', async (req, res) => {
  const [[k]] = await pool.query('SELECT curriculo_arquivo, nome FROM candidatos WHERE id = ? AND instituicao_id = ?', [req.params.id, req.organizacao.id]);
  if (!k?.curriculo_arquivo) return res.status(404).json({ error: 'Currículo não disponível.' });
  enviarPrivado(res, k.curriculo_arquivo, `curriculo-${k.nome.split(' ')[0].toLowerCase()}.pdf`);
});

/* Candidaturas dos estudantes da instituição (estágio e emprego) */
instituicao.get('/candidaturas', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ca.id, ca.status, ca.created_at, ca.updated_at, k.nome AS estudante, k.curso, v.titulo, v.tipo, v.cidade,
            COALESCE(a.nome, o.nome) AS ofertante
       FROM candidaturas ca JOIN candidatos k ON k.id = ca.candidato_id JOIN vagas v ON v.id = ca.vaga_id
       LEFT JOIN associados a ON a.id = v.associado_id LEFT JOIN organizacoes o ON o.id = v.organizacao_id
      WHERE k.instituicao_id = ? AND k.vinculo_status = 'confirmado' ORDER BY ca.updated_at DESC LIMIT 300`, [req.organizacao.id]);
  res.json(rows);
});

instituicao.put('/perfil', async (req, res) => {
  const b = req.body;
  await pool.query('UPDATE organizacoes SET responsavel = ?, cargo = ?, telefone = ?, whatsapp = ?, site = ?, descricao = ? WHERE id = ?', [
    txt(b.responsavel, 120), txt(b.cargo, 80), soDigitos(b.telefone) || null, soDigitos(b.whatsapp) || null, txt(b.site, 200), txt(b.descricao, 3000), req.organizacao.id,
  ]);
  const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [req.organizacao.id]);
  res.json({ conta: publicoConta('instituicao', o) });
});

/* ═══════════════ Empresa parceira: perfil ═══════════════ */
export const empresa = express.Router();
empresa.use(requireOrganizacao('empresa'));

empresa.put('/perfil', async (req, res) => {
  const b = req.body;
  await pool.query('UPDATE organizacoes SET responsavel = ?, cargo = ?, telefone = ?, whatsapp = ?, cidade = ?, uf = ?, site = ?, descricao = ? WHERE id = ?', [
    txt(b.responsavel, 120), txt(b.cargo, 80), soDigitos(b.telefone) || null, soDigitos(b.whatsapp) || null, txt(b.cidade, 80),
    txt(b.uf, 2)?.toUpperCase() || 'SP', txt(b.site, 200), txt(b.descricao, 3000), req.organizacao.id,
  ]);
  const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [req.organizacao.id]);
  res.json({ conta: publicoConta('empresa', o) });
});
