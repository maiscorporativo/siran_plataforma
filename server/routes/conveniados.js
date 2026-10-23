import express from 'express';
import pool from '../db.js';
import { requireAssociado, requireAssociadoAtivo } from '../lib/auth.js';
import { urlPublica } from '../lib/storage.js';
import { like } from '../lib/util.js';

const router = express.Router();
router.use(requireAssociado, requireAssociadoAtivo);

export const formatarConveniado = c => ({ ...c, logo: urlPublica(c.logo) });

/* ── GET /api/conveniados — guia com filtros ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = ['c.ativo = 1'];
  const params = [];
  if (q.q) {
    where.push('(c.nome LIKE ? OR c.descricao LIKE ? OR c.beneficio LIKE ? OR c.area_atendimento LIKE ?)');
    const t = like(q.q);
    params.push(t, t, t, t);
  }
  if (q.categoria) { where.push('c.categoria_id = ?'); params.push(Number(q.categoria)); }
  // Cidade: atende na cidade (sede) ou lista a cidade na área de atendimento
  if (q.cidade) { where.push('(c.cidade = ? OR c.area_atendimento LIKE ?)'); params.push(q.cidade, like(q.cidade)); }
  if (q.atende_24h === '1') where.push('c.atende_24h = 1');
  if (q.entrega_rural === '1') where.push('c.entrega_rural = 1');
  if (q.atende_propriedade === '1') where.push('c.atende_propriedade = 1');

  const [rows] = await pool.query(
    `SELECT c.*, cat.nome AS categoria, cat.icone AS categoria_icone
       FROM conveniados c LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.destaque DESC, c.nome`, params);
  res.json(rows.map(formatarConveniado));
});

/* ── GET /api/conveniados/filtros — categorias e cidades disponíveis ── */
router.get('/filtros', async (_req, res) => {
  const [categorias] = await pool.query(
    `SELECT cat.id, cat.nome, cat.icone, COUNT(c.id) AS total
       FROM categorias cat
       LEFT JOIN conveniados c ON c.categoria_id = cat.id AND c.ativo = 1
      WHERE cat.escopo = 'conveniado' AND cat.ativo = 1
      GROUP BY cat.id ORDER BY cat.ordem, cat.nome`);
  const [cidades] = await pool.query(
    'SELECT DISTINCT cidade FROM conveniados WHERE ativo = 1 AND cidade IS NOT NULL ORDER BY cidade');
  res.json({ categorias, cidades: cidades.map(c => c.cidade) });
});

router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query(
    `SELECT c.*, cat.nome AS categoria FROM conveniados c LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE c.id = ? AND c.ativo = 1`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Conveniado não encontrado.' });
  res.json(formatarConveniado(c));
});

export default router;
