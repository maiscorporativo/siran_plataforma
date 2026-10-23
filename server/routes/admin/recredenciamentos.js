import express from 'express';
import pool, { transaction } from '../../db.js';
import { hojeISO } from '../../lib/auth.js';
import { txt, addMeses, configuracoes, registrarAcao } from '../../lib/util.js';
import { CAMPOS_EDITAVEIS, TIPOS_DOCUMENTO } from '../../lib/associado.js';
import { avisarRecredenciamento } from '../../lib/avisos.js';

const router = express.Router();

/* ── GET /api/admin/recredenciamentos?status=enviado ── */
router.get('/', async (req, res) => {
  const status = ['enviado', 'pendencia', 'aprovado', 'reprovado'].includes(req.query.status) ? req.query.status : 'enviado';
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.created_at, r.analisado_em, r.validade_anterior, r.validade_nova,
            a.id AS associado_id, a.nome, a.matricula, a.cidade, a.validade_ate,
            (SELECT COUNT(*) FROM associado_documentos d WHERE d.recredenciamento_id = r.id) AS documentos
       FROM recredenciamentos r JOIN associados a ON a.id = r.associado_id
      WHERE r.status = ? ORDER BY r.created_at ${status === 'enviado' ? 'ASC' : 'DESC'} LIMIT 200`, [status]);
  res.json(rows);
});

/* ── GET /api/admin/recredenciamentos/:id — compara dados atuais e os enviados ── */
router.get('/:id', async (req, res) => {
  const [[r]] = await pool.query('SELECT * FROM recredenciamentos WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitação não encontrada.' });
  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [r.associado_id]);
  const [documentos] = await pool.query(
    'SELECT id, tipo, nome_original, mime, created_at FROM associado_documentos WHERE recredenciamento_id = ? ORDER BY id', [r.id]);
  const enviados = JSON.parse(r.dados || '{}');
  const campos = [...Object.keys(CAMPOS_EDITAVEIS), 'propriedade_area_ha', 'data_nascimento'];
  const alteracoes = campos
    .filter(c => c in enviados && String(enviados[c] ?? '') !== String(a[c] ?? ''))
    .map(c => ({ campo: c, atual: a[c], novo: enviados[c] }));
  res.json({
    recredenciamento: { ...r, dados: enviados },
    associado: { id: a.id, nome: a.nome, matricula: a.matricula, cpf_cnpj: a.cpf_cnpj, cidade: a.cidade, validade_ate: a.validade_ate, status: a.status },
    alteracoes, documentos, tipos_documento: TIPOS_DOCUMENTO,
  });
});

/* ── POST /api/admin/recredenciamentos/:id/decisao — aprovar | pendencia | reprovar ── */
router.post('/:id/decisao', async (req, res) => {
  const decisao = req.body.decisao;
  if (!['aprovado', 'pendencia', 'reprovado'].includes(decisao)) return res.status(400).json({ error: 'Decisão inválida.' });
  const resposta = txt(req.body.resposta, 2000);
  if (decisao !== 'aprovado' && !resposta) return res.status(400).json({ error: 'Explique ao associado o motivo.' });

  const [[r]] = await pool.query('SELECT * FROM recredenciamentos WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitação não encontrada.' });
  if (r.status !== 'enviado') return res.status(400).json({ error: 'Esta solicitação já foi analisada.' });

  let validadeNova = null;
  await transaction(async conn => {
    if (decisao === 'aprovado') {
      const [[a]] = await conn.query('SELECT validade_ate FROM associados WHERE id = ? FOR UPDATE', [r.associado_id]);
      const cfg = await configuracoes();
      const hoje = hojeISO();
      // Renova a partir do vencimento atual (ou de hoje, se já venceu)
      const base = a.validade_ate && a.validade_ate > hoje ? a.validade_ate : hoje;
      validadeNova = addMeses(base, Number(cfg.validade_meses) || 12);
      const dados = JSON.parse(r.dados || '{}');
      const permitidos = Object.fromEntries(
        Object.entries(dados).filter(([k]) => k in CAMPOS_EDITAVEIS || ['propriedade_area_ha', 'data_nascimento'].includes(k)));
      await conn.query('UPDATE associados SET ?, validade_ate = ? WHERE id = ?',
        [Object.keys(permitidos).length ? permitidos : { validade_ate: validadeNova }, validadeNova, r.associado_id]);
    }
    await conn.query(
      'UPDATE recredenciamentos SET status = ?, resposta = ?, analisado_por = ?, analisado_em = NOW(), validade_nova = ? WHERE id = ?',
      [decisao, resposta, req.admin.id, validadeNova, r.id]);
  });
  await registrarAcao(req.admin.id, `recredenciamento:${decisao}`, 'associado', r.associado_id, resposta);
  avisarRecredenciamento(r.associado_id, decisao, resposta, validadeNova);
  res.json({ ok: true, validade_nova: validadeNova });
});

export default router;
