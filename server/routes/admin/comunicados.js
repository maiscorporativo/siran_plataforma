import express from 'express';
import pool from '../../db.js';
import { uploadComunicado, removerArquivo, enviarPrivado } from '../../lib/storage.js';
import { txt, bool, dataISO, paginacao, like, registrarAcao } from '../../lib/util.js';
import { descartarUploads } from '../../lib/associado.js';
import { ORIGENS, TIPOS_COMUNICADO } from '../comunicados.js';
import { hojeISO } from '../../lib/auth.js';

const router = express.Router();

function ler(b) {
  return {
    origem: ORIGENS.includes(b.origem) ? b.origem : 'FAESP',
    tipo: TIPOS_COMUNICADO.includes(b.tipo) ? b.tipo : 'oficio',
    numero: txt(b.numero, 60),
    titulo: txt(b.titulo, 200),
    resumo: txt(b.resumo, 500),
    conteudo: txt(b.conteudo, 60000),
    data_publicacao: dataISO(b.data_publicacao) || hojeISO(),
    destaque: bool(b.destaque),
    publicado: b.publicado === undefined ? 1 : bool(b.publicado),
  };
}

router.get('/', async (req, res) => {
  const q = req.query;
  const where = ['1=1'];
  const params = [];
  if (ORIGENS.includes(q.origem)) { where.push('c.origem = ?'); params.push(q.origem); }
  if (q.q) { where.push('(c.titulo LIKE ? OR c.numero LIKE ?)'); params.push(like(q.q), like(q.q)); }
  const { limite, offset, pagina, porPagina } = paginacao(q, 30);
  const w = where.join(' AND ');
  const [rows] = await pool.query(
    `SELECT c.id, c.origem, c.tipo, c.numero, c.titulo, c.data_publicacao, c.destaque, c.publicado,
            (c.arquivo IS NOT NULL) AS tem_arquivo,
            (SELECT COUNT(*) FROM comunicado_leituras l WHERE l.comunicado_id = c.id) AS leituras
       FROM comunicados c WHERE ${w} ORDER BY c.data_publicacao DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM comunicados c WHERE ${w}`, params);
  const [[{ ativos }]] = await pool.query("SELECT COUNT(*) AS ativos FROM associados WHERE status = 'ativo'");
  res.json({ itens: rows, total, pagina, por_pagina: porPagina, associados_ativos: ativos });
});

router.get('/:id', async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM comunicados WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Comunicado não encontrado.' });
  res.json(c);
});

router.get('/:id/arquivo', async (req, res) => {
  const [[c]] = await pool.query('SELECT arquivo, arquivo_nome FROM comunicados WHERE id = ?', [req.params.id]);
  if (!c?.arquivo) return res.status(404).json({ error: 'Anexo não encontrado.' });
  enviarPrivado(res, c.arquivo, c.arquivo_nome);
});

router.post('/', uploadComunicado.single('arquivo'), async (req, res) => {
  const d = ler(req.body);
  if (!d.titulo) { descartarUploads(req); return res.status(400).json({ error: 'Informe o título.' }); }
  if (req.file) Object.assign(d, { arquivo: `comunicados/${req.file.filename}`, arquivo_nome: req.file.originalname.slice(0, 255) });
  const [r] = await pool.query('INSERT INTO comunicados SET ?', [{ ...d, created_by: req.admin.id }]);
  await registrarAcao(req.admin.id, 'publicar', 'comunicado', r.insertId, d.titulo);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', uploadComunicado.single('arquivo'), async (req, res) => {
  const [[atual]] = await pool.query('SELECT arquivo FROM comunicados WHERE id = ?', [req.params.id]);
  if (!atual) { descartarUploads(req); return res.status(404).json({ error: 'Comunicado não encontrado.' }); }
  const d = ler(req.body);
  if (!d.titulo) { descartarUploads(req); return res.status(400).json({ error: 'Informe o título.' }); }
  const trocar = req.file || req.body.remover_arquivo === 'true';
  if (req.file) Object.assign(d, { arquivo: `comunicados/${req.file.filename}`, arquivo_nome: req.file.originalname.slice(0, 255) });
  else if (req.body.remover_arquivo === 'true') Object.assign(d, { arquivo: null, arquivo_nome: null });
  await pool.query('UPDATE comunicados SET ? WHERE id = ?', [d, req.params.id]);
  if (trocar) removerArquivo(atual.arquivo, true);
  await registrarAcao(req.admin.id, 'editar', 'comunicado', Number(req.params.id), d.titulo);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [[atual]] = await pool.query('SELECT arquivo, titulo FROM comunicados WHERE id = ?', [req.params.id]);
  if (!atual) return res.status(404).json({ error: 'Comunicado não encontrado.' });
  await pool.query('DELETE FROM comunicados WHERE id = ?', [req.params.id]);
  removerArquivo(atual.arquivo, true);
  await registrarAcao(req.admin.id, 'excluir', 'comunicado', Number(req.params.id), atual.titulo);
  res.json({ ok: true });
});

export default router;
