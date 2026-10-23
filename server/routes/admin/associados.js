import express from 'express';
import bcrypt from 'bcryptjs';
import pool, { transaction } from '../../db.js';
import { hojeISO, gerarSenhaProvisoria, encerrarSessoesDoUsuario } from '../../lib/auth.js';
import { uploadDocumento, uploadPlanilha, enviarPrivado, removerArquivo } from '../../lib/storage.js';
import {
  txt, soDigitos, documentoValido, dataISO, addMeses, addDias, configuracoes, paginacao, like, lerCSV, registrarAcao,
} from '../../lib/util.js';
import {
  lerCamposEditaveis, serializar, salvarDocumentos, descartarUploads, novoCodigoValidacao, proximaMatricula, TIPOS_DOCUMENTO,
} from '../../lib/associado.js';

const router = express.Router();
const STATUS = ['pendente', 'ativo', 'recusado', 'suspenso', 'inativo'];

function filtros(q) {
  const where = ['1=1'];
  const params = [];
  if (q.q) {
    const t = like(q.q);
    const dig = soDigitos(q.q);
    where.push(`(a.nome LIKE ? OR a.matricula = ? OR a.email LIKE ? OR a.cidade LIKE ? OR a.propriedade_nome LIKE ?${dig ? ' OR a.cpf_cnpj LIKE ?' : ''})`);
    params.push(t, q.q.trim(), t, t, t);
    if (dig) params.push(`${dig}%`);
  }
  if (STATUS.includes(q.status)) { where.push('a.status = ?'); params.push(q.status); }
  if (q.situacao === 'vencido') where.push("a.status = 'ativo' AND a.validade_ate < CURDATE()");
  if (q.situacao === 'renovar') {
    where.push("a.status = 'ativo' AND a.validade_ate BETWEEN CURDATE() AND CURDATE() + INTERVAL ? DAY");
    params.push(Number(q.aviso) || 60);
  }
  if (q.inadimplente === '1') {
    where.push("EXISTS (SELECT 1 FROM boletos b WHERE b.associado_id = a.id AND b.status = 'aberto' AND b.vencimento < CURDATE())");
  }
  if (q.cidade) { where.push('a.cidade = ?'); params.push(q.cidade); }
  return { w: where.join(' AND '), params };
}

/* ── GET /api/admin/associados ── */
router.get('/', async (req, res) => {
  const cfg = await configuracoes();
  const { w, params } = filtros({ ...req.query, aviso: cfg.aviso_recredenciamento_dias });
  const { limite, offset, pagina, porPagina } = paginacao(req.query, 30);
  const ordem = { nome: 'a.nome', recentes: 'a.created_at DESC', validade: 'a.validade_ate IS NULL, a.validade_ate', matricula: 'CAST(a.matricula AS UNSIGNED)' }[req.query.ordem]
    || "a.status = 'pendente' DESC, a.nome";
  const [rows] = await pool.query(
    `SELECT a.id, a.matricula, a.nome, a.cpf_cnpj, a.tipo_pessoa, a.cidade, a.uf, a.whatsapp, a.telefone, a.email,
            a.status, a.validade_ate, a.created_at, a.ultimo_login, (a.senha_hash IS NOT NULL) AS tem_senha,
            (SELECT COUNT(*) FROM boletos b WHERE b.associado_id = a.id AND b.status = 'aberto' AND b.vencimento < CURDATE()) AS boletos_vencidos
       FROM associados a WHERE ${w} ORDER BY ${ordem} LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM associados a WHERE ${w}`, params);
  const itens = await Promise.all(rows.map(serializar));
  const [cidades] = await pool.query('SELECT DISTINCT cidade FROM associados WHERE cidade IS NOT NULL ORDER BY cidade');
  res.json({ itens, total, pagina, por_pagina: porPagina, cidades: cidades.map(c => c.cidade) });
});

/* ── GET /api/admin/associados/exportar — planilha CSV com o filtro atual ── */
router.get('/exportar', async (req, res) => {
  const cfg = await configuracoes();
  const { w, params } = filtros({ ...req.query, aviso: cfg.aviso_recredenciamento_dias });
  const [rows] = await pool.query(
    `SELECT a.matricula, a.nome, a.tipo_pessoa, a.cpf_cnpj, a.email, a.telefone, a.whatsapp, a.cidade, a.uf,
            a.propriedade_nome, a.propriedade_municipio, a.propriedade_area_ha, a.atividades,
            a.status, a.data_filiacao, a.validade_ate
       FROM associados a WHERE ${w} ORDER BY a.nome`, params);
  const cab = Object.keys(rows[0] || { matricula: '', nome: '' });
  const esc = v => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);
  const csv = '﻿' + [cab.join(';'), ...rows.map(r => cab.map(c => esc(r[c])).join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="associados-${hojeISO()}.csv"`);
  res.send(csv);
});

/* ── POST /api/admin/associados/importar — carga inicial dos associados atuais ──
   Colunas: nome; cpf_cnpj; matricula; email; telefone; whatsapp; cidade; uf; data_filiacao; validade
   Associados importados entram como ativos e sem senha (acesso via senha provisória). */
router.post('/importar', uploadPlanilha.single('planilha'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie a planilha CSV.' });
  const linhas = lerCSV(req.file.buffer);
  const cfg = await configuracoes();
  const meses = Number(cfg.validade_meses) || 12;
  const resultado = { criados: 0, ignorados: [] };

  for (const [i, l] of linhas.entries()) {
    const n = i + 2;
    const doc = soDigitos(l.cpf_cnpj || l.cpf || l.cnpj);
    const nome = txt(l.nome, 160);
    if (!nome || !documentoValido(doc)) { resultado.ignorados.push({ linha: n, motivo: 'Nome ou CPF/CNPJ inválido' }); continue; }
    const filiacao = dataISO(l.data_filiacao) || hojeISO();
    const dados = {
      nome, cpf_cnpj: doc, tipo_pessoa: doc.length === 14 ? 'PJ' : 'PF',
      matricula: txt(l.matricula, 20),
      email: txt(l.email, 160)?.toLowerCase() || null,
      telefone: soDigitos(l.telefone) || null,
      whatsapp: soDigitos(l.whatsapp || l.celular) || null,
      cidade: txt(l.cidade, 80), uf: txt(l.uf, 2)?.toUpperCase() || null,
      status: 'ativo', data_filiacao: filiacao,
      validade_ate: dataISO(l.validade || l.validade_ate) || addMeses(filiacao, meses),
      codigo_validacao: novoCodigoValidacao(),
    };
    try {
      await pool.query('INSERT INTO associados SET ?', [dados]);
      resultado.criados++;
    } catch (err) {
      resultado.ignorados.push({ linha: n, motivo: err.code === 'ER_DUP_ENTRY' ? 'CPF/CNPJ ou matrícula já cadastrado' : err.message });
    }
  }
  await registrarAcao(req.admin.id, 'importar', 'associado', null, `${resultado.criados} criados`);
  res.json(resultado);
});

/* ── POST /api/admin/associados — cadastro feito pela equipe ── */
router.post('/', async (req, res) => {
  const b = req.body;
  const doc = soDigitos(b.cpf_cnpj);
  const nome = txt(b.nome, 160);
  if (!nome) return res.status(400).json({ error: 'Informe o nome.' });
  if (!documentoValido(doc)) return res.status(400).json({ error: 'CPF ou CNPJ inválido.' });
  const cfg = await configuracoes();
  const ativo = b.status !== 'pendente';
  const hoje = hojeISO();
  const id = await transaction(async conn => {
    const dados = {
      ...lerCamposEditaveis(b), nome, cpf_cnpj: doc, tipo_pessoa: doc.length === 14 ? 'PJ' : 'PF',
      status: ativo ? 'ativo' : 'pendente',
      matricula: txt(b.matricula, 20) || (ativo ? await proximaMatricula(conn) : null),
      data_filiacao: ativo ? dataISO(b.data_filiacao) || hoje : null,
      validade_ate: ativo ? dataISO(b.validade_ate) || addMeses(hoje, Number(cfg.validade_meses) || 12) : null,
      codigo_validacao: novoCodigoValidacao(),
      observacoes: txt(b.observacoes, 5000),
    };
    const [r] = await conn.query('INSERT INTO associados SET ?', [dados]);
    return r.insertId;
  }).catch(err => {
    if (err.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('CPF/CNPJ ou matrícula já cadastrado.'), { status: 409 });
    throw err;
  });
  await registrarAcao(req.admin.id, 'criar', 'associado', id);
  res.status(201).json({ id });
});

/* ── GET /api/admin/associados/:id — ficha completa ── */
router.get('/:id', async (req, res) => {
  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Associado não encontrado.' });
  const [documentos] = await pool.query(
    'SELECT id, tipo, nome_original, mime, tamanho, recredenciamento_id, created_at FROM associado_documentos WHERE associado_id = ? ORDER BY id DESC', [a.id]);
  const [recredenciamentos] = await pool.query(
    'SELECT id, status, resposta, validade_anterior, validade_nova, created_at, analisado_em FROM recredenciamentos WHERE associado_id = ? ORDER BY id DESC', [a.id]);
  const [boletos] = await pool.query(
    `SELECT id, competencia, valor, vencimento, status, pago_em, (status = 'aberto' AND vencimento < CURDATE()) AS vencido
       FROM boletos WHERE associado_id = ? ORDER BY vencimento DESC LIMIT 24`, [a.id]);
  const [[anuncios]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(status = 'aprovado') AS publicados FROM classificados WHERE associado_id = ?", [a.id]);
  const [historico] = await pool.query(
    `SELECT l.acao, l.detalhes, l.created_at, u.nome AS admin
       FROM log_acoes l LEFT JOIN admin_usuarios u ON u.id = l.admin_id
      WHERE l.entidade = 'associado' AND l.entidade_id = ? ORDER BY l.id DESC LIMIT 30`, [a.id]);
  const { senha_hash, ...resto } = a;
  res.json({
    associado: { ...(await serializar(a)), observacoes: resto.observacoes, tem_senha: !!senha_hash },
    documentos, recredenciamentos, boletos, anuncios, historico, tipos_documento: TIPOS_DOCUMENTO,
  });
});

/* ── PUT /api/admin/associados/:id ── */
router.put('/:id', async (req, res) => {
  const b = req.body;
  const dados = lerCamposEditaveis(b);
  if (b.nome !== undefined) {
    dados.nome = txt(b.nome, 160);
    if (!dados.nome) return res.status(400).json({ error: 'Informe o nome.' });
  }
  if (b.cpf_cnpj !== undefined) {
    const doc = soDigitos(b.cpf_cnpj);
    if (!documentoValido(doc)) return res.status(400).json({ error: 'CPF ou CNPJ inválido.' });
    dados.cpf_cnpj = doc;
    dados.tipo_pessoa = doc.length === 14 ? 'PJ' : 'PF';
  }
  if (b.matricula !== undefined) dados.matricula = txt(b.matricula, 20);
  if (b.data_filiacao !== undefined) dados.data_filiacao = dataISO(b.data_filiacao);
  if (b.validade_ate !== undefined) dados.validade_ate = dataISO(b.validade_ate);
  if (b.observacoes !== undefined) dados.observacoes = txt(b.observacoes, 5000);
  try {
    await pool.query('UPDATE associados SET ? WHERE id = ?', [dados, req.params.id]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'CPF/CNPJ ou matrícula já usado por outro associado.' });
    throw err;
  }
  await registrarAcao(req.admin.id, 'editar', 'associado', Number(req.params.id), Object.keys(dados).join(', '));
  res.json({ ok: true });
});

/* ── POST /api/admin/associados/:id/aprovar — aprova o pedido de filiação ── */
router.post('/:id/aprovar', async (req, res) => {
  const [[a]] = await pool.query('SELECT id, status FROM associados WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Associado não encontrado.' });
  if (a.status !== 'pendente') return res.status(400).json({ error: 'Este cadastro não está pendente.' });
  const cfg = await configuracoes();
  const hoje = hojeISO();
  await transaction(async conn => {
    const matricula = txt(req.body.matricula, 20) || (await proximaMatricula(conn));
    await conn.query(
      "UPDATE associados SET status = 'ativo', motivo_status = NULL, matricula = ?, data_filiacao = ?, validade_ate = ? WHERE id = ?",
      [matricula, hoje, addMeses(hoje, Number(cfg.validade_meses) || 12), a.id]);
  }).catch(err => {
    if (err.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('Matrícula já usada por outro associado.'), { status: 409 });
    throw err;
  });
  await registrarAcao(req.admin.id, 'aprovar', 'associado', a.id);
  res.json({ ok: true });
});

/* ── POST /api/admin/associados/:id/status — recusar, suspender, inativar, reativar ── */
router.post('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['recusado', 'suspenso', 'inativo', 'ativo'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  const motivo = txt(req.body.motivo, 255);
  if (status !== 'ativo' && !motivo) return res.status(400).json({ error: 'Informe o motivo.' });
  const [[a]] = await pool.query('SELECT id, status, validade_ate FROM associados WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Associado não encontrado.' });
  if (status === 'ativo' && a.status === 'pendente') return res.status(400).json({ error: 'Use "Aprovar" para cadastros pendentes.' });
  await pool.query('UPDATE associados SET status = ?, motivo_status = ? WHERE id = ?', [status, status === 'ativo' ? null : motivo, a.id]);
  if (['recusado', 'inativo'].includes(status)) await encerrarSessoesDoUsuario('associado', a.id);
  await registrarAcao(req.admin.id, `status:${status}`, 'associado', a.id, motivo);
  res.json({ ok: true });
});

/* ── POST /api/admin/associados/:id/senha-provisoria ── */
router.post('/:id/senha-provisoria', async (req, res) => {
  const senha = gerarSenhaProvisoria();
  const [r] = await pool.query('UPDATE associados SET senha_hash = ?, trocar_senha = 1 WHERE id = ?',
    [await bcrypt.hash(senha, 10), req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Associado não encontrado.' });
  await encerrarSessoesDoUsuario('associado', Number(req.params.id));
  await registrarAcao(req.admin.id, 'senha_provisoria', 'associado', Number(req.params.id));
  res.json({ senha });
});

/* ── POST /api/admin/associados/:id/validade — prorrogação manual ── */
router.post('/:id/validade', async (req, res) => {
  const nova = dataISO(req.body.validade_ate);
  if (!nova) return res.status(400).json({ error: 'Data inválida.' });
  await pool.query('UPDATE associados SET validade_ate = ? WHERE id = ?', [nova, req.params.id]);
  await registrarAcao(req.admin.id, 'validade', 'associado', Number(req.params.id), nova);
  res.json({ ok: true });
});

/* ── Documentos ── */
router.post('/:id/documentos', uploadDocumento.array('documentos', 10), async (req, res) => {
  const [[a]] = await pool.query('SELECT id FROM associados WHERE id = ?', [req.params.id]);
  if (!a) { descartarUploads(req); return res.status(404).json({ error: 'Associado não encontrado.' }); }
  await salvarDocumentos(pool, a.id, req.files, req.body.tipos_documentos);
  await registrarAcao(req.admin.id, 'anexar_documento', 'associado', a.id);
  res.status(201).json({ ok: true });
});

router.get('/documentos/:docId/arquivo', async (req, res) => {
  const [[d]] = await pool.query('SELECT arquivo, nome_original FROM associado_documentos WHERE id = ?', [req.params.docId]);
  if (!d) return res.status(404).json({ error: 'Documento não encontrado.' });
  enviarPrivado(res, d.arquivo, d.nome_original);
});

router.delete('/documentos/:docId', async (req, res) => {
  const [[d]] = await pool.query('SELECT associado_id, arquivo FROM associado_documentos WHERE id = ?', [req.params.docId]);
  if (!d) return res.status(404).json({ error: 'Documento não encontrado.' });
  await pool.query('DELETE FROM associado_documentos WHERE id = ?', [req.params.docId]);
  removerArquivo(d.arquivo, true);
  await registrarAcao(req.admin.id, 'remover_documento', 'associado', d.associado_id);
  res.json({ ok: true });
});

/* Usado pelo painel: associados com credenciamento vencendo nos próximos N dias */
export async function contarVencendo(dias) {
  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM associados WHERE status = 'ativo' AND validade_ate BETWEEN CURDATE() AND ?", [addDias(hojeISO(), dias)]);
  return c;
}

export default router;
