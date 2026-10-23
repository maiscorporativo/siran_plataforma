import express from 'express';
import pool from '../../db.js';
import { uploadLogo, removerArquivo } from '../../lib/storage.js';
import { txt, soDigitos, bool, like, registrarAcao } from '../../lib/util.js';
import { descartarUploads } from '../../lib/associado.js';
import { formatarConveniado } from '../conveniados.js';

const router = express.Router();

function ler(b) {
  return {
    nome: txt(b.nome, 160),
    categoria_id: Number(b.categoria_id) || null,
    descricao: txt(b.descricao, 5000),
    beneficio: txt(b.beneficio, 255),
    logradouro: txt(b.logradouro, 200),
    cidade: txt(b.cidade, 80),
    uf: txt(b.uf, 2)?.toUpperCase() || null,
    area_atendimento: txt(b.area_atendimento, 255),
    telefone: soDigitos(b.telefone) || null,
    whatsapp: soDigitos(b.whatsapp) || null,
    email: txt(b.email, 160)?.toLowerCase() || null,
    site: txt(b.site, 200),
    instagram: txt(b.instagram, 80)?.replace(/^@/, '') || null,
    horario: txt(b.horario, 160),
    atende_24h: bool(b.atende_24h),
    entrega_rural: bool(b.entrega_rural),
    atende_propriedade: bool(b.atende_propriedade),
    destaque: bool(b.destaque),
    ativo: b.ativo === undefined ? 1 : bool(b.ativo),
  };
}

router.get('/', async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.q) { where.push('(c.nome LIKE ? OR c.cidade LIKE ?)'); params.push(like(req.query.q), like(req.query.q)); }
  if (req.query.categoria) { where.push('c.categoria_id = ?'); params.push(Number(req.query.categoria)); }
  const [rows] = await pool.query(
    `SELECT c.*, cat.nome AS categoria FROM conveniados c LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE ${where.join(' AND ')} ORDER BY c.ativo DESC, c.nome`, params);
  res.json(rows.map(formatarConveniado));
});

router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM conveniados WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Conveniado não encontrado.' });
  res.json(formatarConveniado(c));
});

router.post('/', uploadLogo.single('logo'), async (req, res) => {
  const d = ler(req.body);
  if (!d.nome) { descartarUploads(req); return res.status(400).json({ error: 'Informe o nome.' }); }
  if (req.file) d.logo = `conveniados/${req.file.filename}`;
  const [r] = await pool.query('INSERT INTO conveniados SET ?', [d]);
  await registrarAcao(req.admin.id, 'criar', 'conveniado', r.insertId, d.nome);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', uploadLogo.single('logo'), async (req, res) => {
  const [[atual]] = await pool.query('SELECT logo FROM conveniados WHERE id = ?', [req.params.id]);
  if (!atual) { descartarUploads(req); return res.status(404).json({ error: 'Conveniado não encontrado.' }); }
  const d = ler(req.body);
  if (!d.nome) { descartarUploads(req); return res.status(400).json({ error: 'Informe o nome.' }); }
  const trocarLogo = req.file || req.body.remover_logo === 'true';
  if (req.file) d.logo = `conveniados/${req.file.filename}`;
  else if (req.body.remover_logo === 'true') d.logo = null;
  await pool.query('UPDATE conveniados SET ? WHERE id = ?', [d, req.params.id]);
  if (trocarLogo) removerArquivo(atual.logo);
  await registrarAcao(req.admin.id, 'editar', 'conveniado', Number(req.params.id), d.nome);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [[atual]] = await pool.query('SELECT logo, nome FROM conveniados WHERE id = ?', [req.params.id]);
  if (!atual) return res.status(404).json({ error: 'Conveniado não encontrado.' });
  await pool.query('DELETE FROM conveniados WHERE id = ?', [req.params.id]);
  removerArquivo(atual.logo);
  await registrarAcao(req.admin.id, 'excluir', 'conveniado', Number(req.params.id), atual.nome);
  res.json({ ok: true });
});

export default router;
