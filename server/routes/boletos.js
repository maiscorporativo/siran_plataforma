import express from 'express';
import pool from '../db.js';
import { requireAssociado } from '../lib/auth.js';
import { enviarPrivado } from '../lib/storage.js';

const router = express.Router();
router.use(requireAssociado);

/* ── GET /api/boletos — mensalidades do associado logado ── */
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, competencia, descricao, valor, vencimento, linha_digitavel, pix_copia_cola,
            (arquivo IS NOT NULL) AS tem_arquivo, status, pago_em, valor_pago,
            (status = 'aberto' AND vencimento < CURDATE()) AS vencido
       FROM boletos
      WHERE associado_id = ? AND status <> 'cancelado'
      ORDER BY (status = 'aberto') DESC, vencimento DESC`, [req.associado.id]);
  res.json(rows);
});

router.get('/:id/arquivo', async (req, res) => {
  const [[b]] = await pool.query(
    "SELECT arquivo, competencia FROM boletos WHERE id = ? AND associado_id = ? AND status <> 'cancelado'",
    [req.params.id, req.associado.id]);
  if (!b?.arquivo) return res.status(404).json({ error: 'Boleto não disponível.' });
  enviarPrivado(res, b.arquivo, `boleto-siran-${b.competencia}.pdf`);
});

export default router;
