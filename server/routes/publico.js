import express from 'express';
import pool from '../db.js';
import { situacao } from '../lib/associado.js';
import { configuracoes } from '../lib/util.js';

const router = express.Router();

/* ── GET /api/publico/validar/:codigo — conferência da carteirinha (QR Code) ──
   Expõe só o necessário para um conveniado confirmar a filiação. */
router.get('/validar/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (codigo.length !== 16) return res.status(404).json({ error: 'Código inválido.' });
  const [[a]] = await pool.query('SELECT * FROM associados WHERE codigo_validacao = ? LIMIT 1', [codigo]);
  if (!a) return res.status(404).json({ error: 'Carteirinha não encontrada.' });
  res.json({
    nome: a.nome,
    matricula: a.matricula,
    cidade: a.cidade,
    uf: a.uf,
    validade_ate: a.validade_ate,
    situacao: await situacao(a),
  });
});

/* ── GET /api/publico/contato — dados de contato do sindicato ── */
router.get('/contato', async (_req, res) => {
  const cfg = await configuracoes();
  res.json({
    whatsapp: cfg.whatsapp_sindicato || null,
    telefone: cfg.telefone_sindicato || null,
    email: cfg.email_sindicato || null,
  });
});

export default router;
