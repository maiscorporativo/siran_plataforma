import express from 'express';
import pool from '../../db.js';
import { urlPublica, removerArquivo } from '../../lib/storage.js';
import { txt, configuracoes, paginacao, like, registrarAcao } from '../../lib/util.js';
import { EXPIRADO_SQL, statusExibido } from '../classificados.js';
import { avisarAnuncioModerado } from '../../lib/avisos.js';

const router = express.Router();

/* ── GET /api/admin/classificados?status=pendente ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];
  if (q.status === 'expirado') where.push(`c.status = 'aprovado' AND ${EXPIRADO_SQL}`);
  else if (q.status === 'aprovado') where.push(`c.status = 'aprovado' AND NOT ${EXPIRADO_SQL}`);
  else if (['pendente', 'reprovado', 'pausado', 'vendido'].includes(q.status)) { where.push('c.status = ?'); params.push(q.status); }
  if (q.q) { where.push('(c.titulo LIKE ? OR a.nome LIKE ?)'); params.push(like(q.q), like(q.q)); }
  const w = where.length ? where.join(' AND ') : '1=1';
  const { limite, offset, pagina, porPagina } = paginacao(q, 30);
  const [rows] = await pool.query(
    `SELECT c.id, c.titulo, c.tipo, c.preco, c.preco_tipo, c.cidade, c.status, c.motivo_reprovacao, c.created_at, c.updated_at,
            c.publicado_em, c.expira_em, c.visualizacoes, ${EXPIRADO_SQL} AS expirado,
            a.id AS associado_id, a.nome AS anunciante, cat.nome AS categoria,
            (SELECT arquivo FROM classificado_fotos f WHERE f.classificado_id = c.id ORDER BY f.ordem, f.id LIMIT 1) AS capa
       FROM classificados c JOIN associados a ON a.id = c.associado_id LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE ${w} ORDER BY ${q.status === 'pendente' ? 'c.updated_at ASC' : 'c.updated_at DESC'} LIMIT ? OFFSET ?`,
    [...params, limite, offset]);
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM classificados c JOIN associados a ON a.id = c.associado_id WHERE ${w}`, params);
  res.json({
    itens: rows.map(c => ({ ...c, capa: urlPublica(c.capa), status_exibido: statusExibido(c) })),
    total, pagina, por_pagina: porPagina,
  });
});

router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query(
    `SELECT c.*, ${EXPIRADO_SQL} AS expirado, cat.nome AS categoria, a.nome AS anunciante, a.matricula, a.whatsapp AS anunciante_whatsapp
       FROM classificados c JOIN associados a ON a.id = c.associado_id LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE c.id = ?`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Anúncio não encontrado.' });
  const [fotos] = await pool.query('SELECT id, arquivo FROM classificado_fotos WHERE classificado_id = ? ORDER BY ordem, id', [c.id]);
  res.json({ ...c, status_exibido: statusExibido(c), fotos: fotos.map(f => ({ id: f.id, url: urlPublica(f.arquivo) })) });
});

/* ── POST /api/admin/classificados/:id/moderar — aprovar | reprovar ── */
router.post('/:id/moderar', async (req, res) => {
  const { decisao } = req.body;
  const motivo = txt(req.body.motivo, 255);
  const [[c]] = await pool.query('SELECT id, status FROM classificados WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Anúncio não encontrado.' });

  if (decisao === 'aprovar') {
    const cfg = await configuracoes();
    const dias = Number(cfg.anuncio_validade_dias) || 60;
    await pool.query(
      `UPDATE classificados SET status = 'aprovado', motivo_reprovacao = NULL, moderado_por = ?,
              publicado_em = NOW(), expira_em = NOW() + INTERVAL ? DAY WHERE id = ?`, [req.admin.id, dias, c.id]);
  } else if (decisao === 'reprovar') {
    if (!motivo) return res.status(400).json({ error: 'Informe o motivo para o associado corrigir o anúncio.' });
    await pool.query(
      "UPDATE classificados SET status = 'reprovado', motivo_reprovacao = ?, moderado_por = ? WHERE id = ?", [motivo, req.admin.id, c.id]);
  } else {
    return res.status(400).json({ error: 'Decisão inválida.' });
  }
  await registrarAcao(req.admin.id, decisao, 'classificado', c.id, motivo);
  avisarAnuncioModerado(c.id, decisao, motivo);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [fotos] = await pool.query('SELECT arquivo FROM classificado_fotos WHERE classificado_id = ?', [req.params.id]);
  const [r] = await pool.query('DELETE FROM classificados WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Anúncio não encontrado.' });
  fotos.forEach(f => removerArquivo(f.arquivo));
  await registrarAcao(req.admin.id, 'excluir', 'classificado', Number(req.params.id));
  res.json({ ok: true });
});

export default router;
