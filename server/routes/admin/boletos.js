import express from 'express';
import pool from '../../db.js';
import { uploadBoleto, uploadPlanilha, removerArquivo, enviarPrivado } from '../../lib/storage.js';
import { txt, dinheiro, dataISO, soDigitos, paginacao, like, lerCSV, registrarAcao } from '../../lib/util.js';
import { descartarUploads } from '../../lib/associado.js';
import { hojeISO } from '../../lib/auth.js';
import { avisarBoletoDisponivel } from '../../lib/avisos.js';

const router = express.Router();
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/* Aceita "2026-10", "10/2026" ou "102026" */
function lerCompetencia(v) {
  const s = String(v || '').trim();
  if (COMPETENCIA.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-]?(\d{4})$/);
  if (m) {
    const c = `${m[2]}-${m[1].padStart(2, '0')}`;
    return COMPETENCIA.test(c) ? c : null;
  }
  return null;
}

/* Localiza o associado pelo CPF/CNPJ ou matrícula */
async function acharAssociado({ documento, matricula }) {
  const doc = soDigitos(documento);
  if (doc) {
    const [[a]] = await pool.query('SELECT id, nome FROM associados WHERE cpf_cnpj = ?', [doc]);
    if (a) return a;
  }
  if (matricula) {
    const [[a]] = await pool.query('SELECT id, nome FROM associados WHERE matricula = ?', [String(matricula).trim()]);
    if (a) return a;
  }
  return null;
}

/* Identifica o associado pelo nome do arquivo PDF: procura CPF/CNPJ e, depois, matrícula */
async function associadoDoArquivo(nome) {
  const base = nome.replace(/\.pdf$/i, '');
  const blocos = (base.match(/\d[\d.\-/]*\d|\d/g) || []).map(soDigitos);
  for (const b of blocos.filter(b => b.length === 11 || b.length === 14)) {
    const a = await acharAssociado({ documento: b });
    if (a) return a;
  }
  for (const b of blocos.filter(b => b.length < 11)) {
    const a = await acharAssociado({ matricula: b.replace(/^0+/, '') || b }) || await acharAssociado({ matricula: b });
    if (a) return a;
  }
  return null;
}

/* ── GET /api/admin/boletos ── */
router.get('/', async (req, res) => {
  const q = req.query;
  const where = ['1=1'];
  const params = [];
  if (q.competencia) { where.push('b.competencia = ?'); params.push(q.competencia); }
  if (q.status === 'vencido') where.push("b.status = 'aberto' AND b.vencimento < CURDATE()");
  else if (['aberto', 'pago', 'cancelado'].includes(q.status)) { where.push('b.status = ?'); params.push(q.status); }
  if (q.associado_id) { where.push('b.associado_id = ?'); params.push(Number(q.associado_id)); }
  if (q.q) {
    const dig = soDigitos(q.q);
    where.push(`(a.nome LIKE ? OR a.matricula = ?${dig ? ' OR a.cpf_cnpj LIKE ?' : ''})`);
    params.push(like(q.q), q.q.trim());
    if (dig) params.push(`${dig}%`);
  }
  const { limite, offset, pagina, porPagina } = paginacao(q, 50);
  const w = where.join(' AND ');
  const [rows] = await pool.query(
    `SELECT b.id, b.competencia, b.descricao, b.valor, b.vencimento, b.status, b.pago_em, b.valor_pago,
            b.linha_digitavel, (b.arquivo IS NOT NULL) AS tem_arquivo, (b.status = 'aberto' AND b.vencimento < CURDATE()) AS vencido,
            a.id AS associado_id, a.nome, a.matricula, a.cpf_cnpj
       FROM boletos b JOIN associados a ON a.id = b.associado_id
      WHERE ${w} ORDER BY b.vencimento DESC, a.nome LIMIT ? OFFSET ?`, [...params, limite, offset]);
  const [[totais]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(b.status = 'aberto') AS abertos, SUM(b.status = 'pago') AS pagos,
            SUM(b.status = 'aberto' AND b.vencimento < CURDATE()) AS vencidos,
            COALESCE(SUM(CASE WHEN b.status = 'pago' THEN COALESCE(b.valor_pago, b.valor) END), 0) AS valor_recebido,
            COALESCE(SUM(CASE WHEN b.status = 'aberto' THEN b.valor END), 0) AS valor_aberto
       FROM boletos b JOIN associados a ON a.id = b.associado_id WHERE ${w}`, params);
  const [competencias] = await pool.query('SELECT DISTINCT competencia FROM boletos ORDER BY competencia DESC LIMIT 36');
  res.json({ itens: rows, total: totais.total, totais, pagina, por_pagina: porPagina, competencias: competencias.map(c => c.competencia) });
});

/* ── POST /api/admin/boletos — lançamento individual ── */
router.post('/', uploadBoleto.single('arquivo'), async (req, res) => {
  const b = req.body;
  const falha = e => { descartarUploads(req); return res.status(400).json({ error: e }); };
  const competencia = lerCompetencia(b.competencia);
  const vencimento = dataISO(b.vencimento);
  const valor = dinheiro(b.valor);
  if (!Number(b.associado_id)) return falha('Escolha o associado.');
  if (!competencia) return falha('Competência inválida (use MM/AAAA).');
  if (!vencimento) return falha('Informe o vencimento.');
  if (!valor || valor <= 0) return falha('Informe o valor.');
  if (!req.file && !txt(b.linha_digitavel) && !txt(b.pix_copia_cola)) return falha('Anexe o PDF ou informe a linha digitável / Pix.');

  try {
    const [r] = await pool.query('INSERT INTO boletos SET ?', [{
      associado_id: Number(b.associado_id), competencia, vencimento, valor,
      descricao: txt(b.descricao, 160) || `Mensalidade ${competencia.slice(5)}/${competencia.slice(0, 4)}`,
      linha_digitavel: soDigitos(b.linha_digitavel) || null,
      pix_copia_cola: txt(b.pix_copia_cola, 2000),
      arquivo: req.file ? `boletos/${req.file.filename}` : null,
      created_by: req.admin.id,
    }]);
    await registrarAcao(req.admin.id, 'lancar_boleto', 'associado', Number(b.associado_id), competencia);
    if (b.avisar !== 'false') avisarBoletoDisponivel(r.insertId);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    descartarUploads(req);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe boleto deste associado para essa competência.' });
    throw err;
  }
});

/* ── POST /api/admin/boletos/lote — vários PDFs de uma vez ──
   O associado é identificado pelo CPF/CNPJ ou matrícula no nome do arquivo
   (ex.: 12345678909.pdf, boleto_123.pdf). */
router.post('/lote', uploadBoleto.array('arquivos', 500), async (req, res) => {
  const b = req.body;
  const competencia = lerCompetencia(b.competencia);
  const vencimento = dataISO(b.vencimento);
  const valor = dinheiro(b.valor);
  if (!competencia || !vencimento || !valor) {
    descartarUploads(req);
    return res.status(400).json({ error: 'Informe competência, vencimento e valor.' });
  }
  const resultado = { criados: [], substituidos: [], nao_identificados: [], ignorados: [] };
  for (const f of req.files || []) {
    const a = await associadoDoArquivo(f.originalname);
    if (!a) { resultado.nao_identificados.push(f.originalname); removerArquivo(`boletos/${f.filename}`, true); continue; }
    const [[existente]] = await pool.query('SELECT id, status, arquivo FROM boletos WHERE associado_id = ? AND competencia = ?', [a.id, competencia]);
    const rel = `boletos/${f.filename}`;
    if (existente) {
      if (existente.status !== 'aberto') {
        resultado.ignorados.push({ arquivo: f.originalname, nome: a.nome, motivo: `boleto já ${existente.status}` });
        removerArquivo(rel, true);
        continue;
      }
      await pool.query('UPDATE boletos SET arquivo = ?, vencimento = ?, valor = ? WHERE id = ?', [rel, vencimento, valor, existente.id]);
      removerArquivo(existente.arquivo, true);
      resultado.substituidos.push({ arquivo: f.originalname, nome: a.nome });
    } else {
      const [ins] = await pool.query('INSERT INTO boletos SET ?', [{
        associado_id: a.id, competencia, vencimento, valor, arquivo: rel, created_by: req.admin.id,
        descricao: txt(b.descricao, 160) || `Mensalidade ${competencia.slice(5)}/${competencia.slice(0, 4)}`,
      }]);
      resultado.criados.push({ arquivo: f.originalname, nome: a.nome });
      if (b.avisar !== 'false') avisarBoletoDisponivel(ins.insertId);
    }
  }
  await registrarAcao(req.admin.id, 'lote_boletos', 'boleto', null,
    `${competencia}: ${resultado.criados.length} criados, ${resultado.substituidos.length} substituídos`);
  res.json(resultado);
});

/* ── POST /api/admin/boletos/baixas — baixa por planilha CSV do banco ──
   Colunas: cpf_cnpj (ou matricula); competencia; data_pagamento; valor_pago */
router.post('/baixas', uploadPlanilha.single('planilha'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie a planilha CSV.' });
  const linhas = lerCSV(req.file.buffer);
  const resultado = { baixados: 0, erros: [] };
  for (const [i, l] of linhas.entries()) {
    const n = i + 2;
    const a = await acharAssociado({ documento: l.cpf_cnpj || l.cpf || l.cnpj, matricula: l.matricula });
    const competencia = lerCompetencia(l.competencia);
    if (!a) { resultado.erros.push({ linha: n, motivo: 'Associado não encontrado' }); continue; }
    if (!competencia) { resultado.erros.push({ linha: n, motivo: 'Competência inválida' }); continue; }
    const [r] = await pool.query(
      "UPDATE boletos SET status = 'pago', pago_em = ?, valor_pago = ? WHERE associado_id = ? AND competencia = ? AND status = 'aberto'",
      [dataISO(l.data_pagamento || l.pago_em) || hojeISO(), dinheiro(l.valor_pago || l.valor), a.id, competencia]);
    if (r.affectedRows) resultado.baixados++;
    else resultado.erros.push({ linha: n, motivo: `Sem boleto em aberto de ${competencia} para ${a.nome}` });
  }
  await registrarAcao(req.admin.id, 'baixas_planilha', 'boleto', null, `${resultado.baixados} baixados`);
  res.json(resultado);
});

router.get('/:id/arquivo', async (req, res) => {
  const [[b]] = await pool.query('SELECT arquivo, competencia FROM boletos WHERE id = ?', [req.params.id]);
  if (!b?.arquivo) return res.status(404).json({ error: 'Boleto sem arquivo.' });
  enviarPrivado(res, b.arquivo, `boleto-${b.competencia}.pdf`);
});

/* ── POST /api/admin/boletos/:id/situacao — pago | aberto (estorno) | cancelado ── */
router.post('/:id/situacao', async (req, res) => {
  const { status } = req.body;
  const [[b]] = await pool.query('SELECT id, associado_id, competencia FROM boletos WHERE id = ?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'Boleto não encontrado.' });
  if (status === 'pago') {
    await pool.query("UPDATE boletos SET status = 'pago', pago_em = ?, valor_pago = ? WHERE id = ?",
      [dataISO(req.body.pago_em) || hojeISO(), dinheiro(req.body.valor_pago), b.id]);
  } else if (status === 'aberto' || status === 'cancelado') {
    await pool.query('UPDATE boletos SET status = ?, pago_em = NULL, valor_pago = NULL WHERE id = ?', [status, b.id]);
  } else {
    return res.status(400).json({ error: 'Situação inválida.' });
  }
  await registrarAcao(req.admin.id, `boleto:${status}`, 'associado', b.associado_id, b.competencia);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [[b]] = await pool.query('SELECT associado_id, arquivo, competencia, status FROM boletos WHERE id = ?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'Boleto não encontrado.' });
  if (b.status === 'pago') return res.status(400).json({ error: 'Boletos pagos não podem ser excluídos. Estorne antes, se necessário.' });
  await pool.query('DELETE FROM boletos WHERE id = ?', [req.params.id]);
  removerArquivo(b.arquivo, true);
  await registrarAcao(req.admin.id, 'excluir_boleto', 'associado', b.associado_id, b.competencia);
  res.json({ ok: true });
});

export default router;
