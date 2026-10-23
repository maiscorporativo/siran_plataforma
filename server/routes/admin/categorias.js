import express from 'express';
import pool from '../../db.js';
import { txt, bool } from '../../lib/util.js';

const router = express.Router();
const ESCOPOS = ['classificado', 'conveniado'];

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.get('/', async (req, res) => {
  const escopo = ESCOPOS.includes(req.query.escopo) ? req.query.escopo : 'classificado';
  const tabela = escopo === 'classificado' ? 'classificados' : 'conveniados';
  const [rows] = await pool.query(
    `SELECT cat.*, (SELECT COUNT(*) FROM ${tabela} x WHERE x.categoria_id = cat.id) AS uso
       FROM categorias cat WHERE cat.escopo = ? ORDER BY cat.ordem, cat.nome`, [escopo]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const escopo = ESCOPOS.includes(req.body.escopo) ? req.body.escopo : null;
  const nome = txt(req.body.nome, 80);
  if (!escopo || !nome) return res.status(400).json({ error: 'Informe o nome da categoria.' });
  const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(ordem), 0) + 1 AS m FROM categorias WHERE escopo = ?', [escopo]);
  try {
    const [r] = await pool.query('INSERT INTO categorias (escopo, nome, slug, icone, ordem) VALUES (?, ?, ?, ?, ?)',
      [escopo, nome, slugify(nome), txt(req.body.icone, 40), m]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const nome = txt(req.body.nome, 80);
  if (!nome) return res.status(400).json({ error: 'Informe o nome da categoria.' });
  await pool.query('UPDATE categorias SET nome = ?, icone = ?, ordem = ?, ativo = ? WHERE id = ?',
    [nome, txt(req.body.icone, 40), Number(req.body.ordem) || 0, bool(req.body.ativo), req.params.id]);
  res.json({ ok: true });
});

/* Excluir só quando não está em uso; senão, desative */
router.delete('/:id', async (req, res) => {
  const [[cat]] = await pool.query('SELECT escopo FROM categorias WHERE id = ?', [req.params.id]);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });
  const tabela = cat.escopo === 'classificado' ? 'classificados' : 'conveniados';
  const [[{ uso }]] = await pool.query(`SELECT COUNT(*) AS uso FROM ${tabela} WHERE categoria_id = ?`, [req.params.id]);
  if (uso > 0) return res.status(400).json({ error: `Categoria em uso por ${uso} registro(s). Desative-a em vez de excluir.` });
  await pool.query('DELETE FROM categorias WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
