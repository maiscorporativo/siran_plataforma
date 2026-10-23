import express from 'express';
import pool from '../db.js';
import { requireAssociado, requireAssociadoAtivo } from '../lib/auth.js';
import { enviarPrivado } from '../lib/storage.js';
import { paginacao, like } from '../lib/util.js';

const router = express.Router();
router.use(requireAssociado, requireAssociadoAtivo);

export const ORIGENS = ['FAESP', 'SENAR', 'CNA', 'SIRAN', 'OUTROS'];
export const TIPOS_COMUNICADO = ['oficio', 'circular', 'comunicado', 'convencao', 'informativo'];

/* ── GET /api/comunicados ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = ['c.publicado = 1'];
  const params = [req.associado.id];
  if (ORIGENS.includes(q.origem)) { where.push('c.origem = ?'); params.push(q.origem); }
  if (TIPOS_COMUNICADO.includes(q.tipo)) { where.push('c.tipo = ?'); params.push(q.tipo); }
  if (q.ano) { where.push('YEAR(c.data_publicacao) = ?'); params.push(Number(q.ano)); }
  if (q.q) {
    where.push('(c.titulo LIKE ? OR c.resumo LIKE ? OR c.numero LIKE ? OR c.conteudo LIKE ?)');
    const t = like(q.q);
    params.push(t, t, t, t);
  }
  if (q.nao_lidos === '1') where.push('l.associado_id IS NULL');

  const { limite, offset, pagina, porPagina } = paginacao(q, 20);
  const w = where.join(' AND ');
  const join = 'LEFT JOIN comunicado_leituras l ON l.comunicado_id = c.id AND l.associado_id = ?';
  const [rows] = await pool.query(
    `SELECT c.id, c.origem, c.tipo, c.numero, c.titulo, c.resumo, c.data_publicacao, c.destaque,
            (c.arquivo IS NOT NULL) AS tem_arquivo, (l.associado_id IS NOT NULL) AS lido
       FROM comunicados c ${join}
      WHERE ${w} ORDER BY c.data_publicacao DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM comunicados c ${join} WHERE ${w}`, params);
  const [anos] = await pool.query(
    'SELECT DISTINCT YEAR(data_publicacao) AS ano FROM comunicados WHERE publicado = 1 ORDER BY ano DESC');
  res.json({ itens: rows, total, pagina, por_pagina: porPagina, anos: anos.map(a => a.ano) });
});

/* ── GET /api/comunicados/:id — abre e marca como lido ── */
router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query(
    `SELECT id, origem, tipo, numero, titulo, resumo, conteudo, data_publicacao, destaque,
            (arquivo IS NOT NULL) AS tem_arquivo, arquivo_nome
       FROM comunicados WHERE id = ? AND publicado = 1`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Comunicado não encontrado.' });
  await pool.query('INSERT IGNORE INTO comunicado_leituras (comunicado_id, associado_id) VALUES (?, ?)', [c.id, req.associado.id]);
  res.json(c);
});

router.get('/:id/arquivo', async (req, res) => {
  const [[c]] = await pool.query('SELECT arquivo, arquivo_nome FROM comunicados WHERE id = ? AND publicado = 1', [req.params.id]);
  if (!c?.arquivo) return res.status(404).json({ error: 'Anexo não encontrado.' });
  enviarPrivado(res, c.arquivo, c.arquivo_nome || 'comunicado.pdf');
});

export default router;
