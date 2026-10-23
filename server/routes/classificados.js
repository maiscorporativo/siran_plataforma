import express from 'express';
import pool, { transaction } from '../db.js';
import { requireAssociado, requireAssociadoAtivo, requireAssociadoRegular } from '../lib/auth.js';
import { uploadFotoAnuncio, removerArquivo, urlPublica } from '../lib/storage.js';
import { txt, dinheiro, soDigitos, configuracoes, paginacao, like } from '../lib/util.js';
import { descartarUploads } from '../lib/associado.js';

const router = express.Router();
router.use(requireAssociado, requireAssociadoAtivo);

const TIPOS = ['venda', 'servico', 'procura', 'troca'];
const PRECO_TIPOS = ['fixo', 'negociavel', 'a_combinar'];
const CONDICOES = ['novo', 'usado', 'nao_se_aplica'];

export const EXPIRADO_SQL = '(c.expira_em IS NOT NULL AND c.expira_em <= NOW())';
const CAPA_SQL = `(SELECT arquivo FROM classificado_fotos f WHERE f.classificado_id = c.id ORDER BY f.ordem, f.id LIMIT 1)`;

/* Status exibido: anúncio aprovado com prazo vencido aparece como "expirado".
   "expirado" vem calculado no SQL (EXPIRADO_SQL) para usar o relógio do banco. */
export function statusExibido(c) {
  if (c.status === 'aprovado' && Number(c.expirado)) return 'expirado';
  return c.status;
}

function lerAnuncio(b) {
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : 'venda';
  const preco_tipo = PRECO_TIPOS.includes(b.preco_tipo) ? b.preco_tipo : 'fixo';
  const ano = Number(b.ano);
  return {
    categoria_id: Number(b.categoria_id) || null,
    tipo,
    titulo: txt(b.titulo, 120),
    descricao: txt(b.descricao, 5000),
    preco: preco_tipo === 'a_combinar' ? null : dinheiro(b.preco),
    preco_tipo,
    condicao: CONDICOES.includes(b.condicao) ? b.condicao : 'nao_se_aplica',
    marca: txt(b.marca, 60),
    modelo: txt(b.modelo, 60),
    ano: ano >= 1900 && ano <= 2100 ? ano : null,
    cidade: txt(b.cidade, 80),
    uf: txt(b.uf, 2)?.toUpperCase() || null,
    contato_whatsapp: soDigitos(b.contato_whatsapp) || null,
    contato_telefone: soDigitos(b.contato_telefone) || null,
  };
}

function validar(d) {
  if (!d.titulo || d.titulo.length < 5) return 'Informe um título com pelo menos 5 caracteres.';
  if (!d.descricao || d.descricao.length < 20) return 'Descreva o anúncio com pelo menos 20 caracteres.';
  if (!d.categoria_id) return 'Escolha uma categoria.';
  if (!d.cidade) return 'Informe a cidade.';
  if (!d.contato_whatsapp && !d.contato_telefone) return 'Informe um WhatsApp ou telefone para contato.';
  if (d.preco_tipo !== 'a_combinar' && d.tipo === 'venda' && !d.preco) return 'Informe o preço ou marque "a combinar".';
  return null;
}

function formatar(c) {
  return { ...c, capa: urlPublica(c.capa), status_exibido: statusExibido(c) };
}

/* ── GET /api/classificados/categorias ── */
router.get('/categorias', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT cat.id, cat.nome, cat.slug, cat.icone,
            (SELECT COUNT(*) FROM classificados c WHERE c.categoria_id = cat.id AND c.status = 'aprovado' AND c.expira_em > NOW()) AS total
       FROM categorias cat WHERE cat.escopo = 'classificado' AND cat.ativo = 1 ORDER BY cat.ordem, cat.nome`);
  res.json(rows);
});

/* ── GET /api/classificados — vitrine com filtros ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = ["c.status = 'aprovado'", 'c.expira_em > NOW()'];
  const params = [];
  if (q.q) {
    where.push('(c.titulo LIKE ? OR c.descricao LIKE ? OR c.marca LIKE ? OR c.modelo LIKE ?)');
    const t = like(q.q);
    params.push(t, t, t, t);
  }
  if (q.categoria) { where.push('c.categoria_id = ?'); params.push(Number(q.categoria)); }
  if (TIPOS.includes(q.tipo)) { where.push('c.tipo = ?'); params.push(q.tipo); }
  if (q.cidade) { where.push('c.cidade = ?'); params.push(q.cidade); }
  if (q.preco_min) { where.push('c.preco >= ?'); params.push(dinheiro(q.preco_min)); }
  if (q.preco_max) { where.push('c.preco <= ?'); params.push(dinheiro(q.preco_max)); }

  const ordem = { recentes: 'c.publicado_em DESC', menor_preco: 'c.preco IS NULL, c.preco ASC', maior_preco: 'c.preco DESC' }[q.ordem]
    || 'c.publicado_em DESC';
  const { limite, offset, pagina, porPagina } = paginacao(q, 24);
  const w = where.join(' AND ');

  const [rows] = await pool.query(
    `SELECT c.id, c.titulo, c.tipo, c.preco, c.preco_tipo, c.condicao, c.ano, c.cidade, c.uf, c.publicado_em, c.status, c.expira_em,
            cat.nome AS categoria, ${CAPA_SQL} AS capa
       FROM classificados c LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE ${w} ORDER BY ${ordem} LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM classificados c WHERE ${w}`, params);
  const [cidades] = await pool.query(
    "SELECT DISTINCT cidade FROM classificados WHERE status = 'aprovado' AND expira_em > NOW() AND cidade IS NOT NULL ORDER BY cidade");

  res.json({ itens: rows.map(formatar), total, pagina, por_pagina: porPagina, cidades: cidades.map(c => c.cidade) });
});

/* ── GET /api/classificados/meus ── */
router.get('/meus', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, ${EXPIRADO_SQL} AS expirado, cat.nome AS categoria, ${CAPA_SQL} AS capa
       FROM classificados c LEFT JOIN categorias cat ON cat.id = c.categoria_id
      WHERE c.associado_id = ? ORDER BY c.updated_at DESC`, [req.associado.id]);
  const cfg = await configuracoes();
  res.json({ itens: rows.map(formatar), max_fotos: Number(cfg.anuncio_max_fotos) || 8 });
});

async function carregar(id) {
  const [[c]] = await pool.query(
    `SELECT c.*, ${EXPIRADO_SQL} AS expirado, cat.nome AS categoria, a.nome AS anunciante, a.cidade AS anunciante_cidade
       FROM classificados c
       LEFT JOIN categorias cat ON cat.id = c.categoria_id
       JOIN associados a ON a.id = c.associado_id
      WHERE c.id = ?`, [id]);
  if (!c) return null;
  const [fotos] = await pool.query('SELECT id, arquivo, ordem FROM classificado_fotos WHERE classificado_id = ? ORDER BY ordem, id', [id]);
  return { ...c, status_exibido: statusExibido(c), fotos: fotos.map(f => ({ id: f.id, url: urlPublica(f.arquivo) })) };
}

/* ── GET /api/classificados/:id ── */
router.get('/:id', async (req, res) => {
  const c = await carregar(req.params.id);
  const dono = c && c.associado_id === req.associado.id;
  if (!c || (!dono && c.status_exibido !== 'aprovado')) return res.status(404).json({ error: 'Anúncio não encontrado ou encerrado.' });
  if (!dono) await pool.query('UPDATE classificados SET visualizacoes = visualizacoes + 1 WHERE id = ?', [c.id]);
  const { moderado_por: _m, ...resto } = c;
  res.json({ ...resto, meu: dono });
});

/* ── POST /api/classificados — novo anúncio (vai para moderação) ── */
router.post('/', requireAssociadoRegular, uploadFotoAnuncio.array('fotos', 12), async (req, res) => {
  const d = lerAnuncio(req.body);
  const erro = validar(d);
  const cfg = await configuracoes();
  const maxFotos = Number(cfg.anuncio_max_fotos) || 8;
  if (erro || (req.files?.length || 0) > maxFotos) {
    descartarUploads(req);
    return res.status(400).json({ error: erro || `Envie no máximo ${maxFotos} fotos.` });
  }
  const id = await transaction(async conn => {
    const [r] = await conn.query('INSERT INTO classificados SET ?', [{ ...d, associado_id: req.associado.id, status: 'pendente' }]);
    for (const [i, f] of (req.files || []).entries()) {
      await conn.query('INSERT INTO classificado_fotos (classificado_id, arquivo, ordem) VALUES (?, ?, ?)', [r.insertId, `anuncios/${f.filename}`, i]);
    }
    return r.insertId;
  }).catch(err => { descartarUploads(req); throw err; });
  res.status(201).json({ id });
});

async function meuAnuncio(req, res) {
  const [[c]] = await pool.query(`SELECT c.*, ${EXPIRADO_SQL} AS expirado FROM classificados c WHERE c.id = ? AND c.associado_id = ?`, [req.params.id, req.associado.id]);
  if (!c) res.status(404).json({ error: 'Anúncio não encontrado.' });
  return c;
}

/* ── PUT /api/classificados/:id — edição volta para moderação ── */
router.put('/:id', requireAssociadoRegular, uploadFotoAnuncio.array('fotos', 12), async (req, res) => {
  const atual = await meuAnuncio(req, res);
  if (!atual) return descartarUploads(req);
  const d = lerAnuncio(req.body);
  const erro = validar(d);
  if (erro) { descartarUploads(req); return res.status(400).json({ error: erro }); }

  const remover = JSON.parse(req.body.remover_fotos || '[]').map(Number);
  const cfg = await configuracoes();
  const maxFotos = Number(cfg.anuncio_max_fotos) || 8;
  const [fotos] = await pool.query('SELECT id, arquivo FROM classificado_fotos WHERE classificado_id = ?', [atual.id]);
  const restantes = fotos.filter(f => !remover.includes(f.id));
  if (restantes.length + (req.files?.length || 0) > maxFotos) {
    descartarUploads(req);
    return res.status(400).json({ error: `O anúncio pode ter no máximo ${maxFotos} fotos.` });
  }

  await transaction(async conn => {
    await conn.query("UPDATE classificados SET ?, status = 'pendente', motivo_reprovacao = NULL WHERE id = ?", [d, atual.id]);
    for (const f of fotos.filter(f => remover.includes(f.id))) {
      await conn.query('DELETE FROM classificado_fotos WHERE id = ?', [f.id]);
    }
    let ordem = restantes.length;
    for (const f of req.files || []) {
      await conn.query('INSERT INTO classificado_fotos (classificado_id, arquivo, ordem) VALUES (?, ?, ?)', [atual.id, `anuncios/${f.filename}`, ordem++]);
    }
  }).catch(err => { descartarUploads(req); throw err; });
  for (const f of fotos.filter(f => remover.includes(f.id))) removerArquivo(f.arquivo);
  res.json({ ok: true });
});

/* ── POST /api/classificados/:id/acao — pausar, reativar, vendido, renovar ── */
router.post('/:id/acao', async (req, res) => {
  const c = await meuAnuncio(req, res);
  if (!c) return;
  const cfg = await configuracoes();
  const dias = Number(cfg.anuncio_validade_dias) || 60;
  const exibido = statusExibido(c);

  switch (req.body.acao) {
    case 'pausar':
      if (c.status !== 'aprovado') return res.status(400).json({ error: 'Só anúncios publicados podem ser pausados.' });
      await pool.query("UPDATE classificados SET status = 'pausado' WHERE id = ?", [c.id]);
      break;
    case 'reativar':
      if (c.status !== 'pausado') return res.status(400).json({ error: 'Este anúncio não está pausado.' });
      await pool.query(
        "UPDATE classificados SET status = 'aprovado', expira_em = GREATEST(COALESCE(expira_em, NOW()), NOW() + INTERVAL 7 DAY) WHERE id = ?",
        [c.id]);
      break;
    case 'vendido':
      await pool.query("UPDATE classificados SET status = 'vendido' WHERE id = ?", [c.id]);
      break;
    case 'renovar':
      if (exibido !== 'expirado') return res.status(400).json({ error: 'Só anúncios expirados podem ser renovados.' });
      await pool.query('UPDATE classificados SET expira_em = NOW() + INTERVAL ? DAY WHERE id = ?', [dias, c.id]);
      break;
    default:
      return res.status(400).json({ error: 'Ação inválida.' });
  }
  res.json({ ok: true });
});

/* ── DELETE /api/classificados/:id ── */
router.delete('/:id', async (req, res) => {
  const c = await meuAnuncio(req, res);
  if (!c) return;
  const [fotos] = await pool.query('SELECT arquivo FROM classificado_fotos WHERE classificado_id = ?', [c.id]);
  await pool.query('DELETE FROM classificados WHERE id = ?', [c.id]);
  fotos.forEach(f => removerArquivo(f.arquivo));
  res.json({ ok: true });
});

export default router;
