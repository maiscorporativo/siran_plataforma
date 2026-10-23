import express from 'express';
import pool, { transaction } from '../db.js';
import { requireAssociado, requireAssociadoAtivo, hojeISO } from '../lib/auth.js';
import { uploadDocumento, enviarPrivado, removerArquivo } from '../lib/storage.js';
import { configuracoes, addDias } from '../lib/util.js';
import {
  lerCamposEditaveis, serializar, salvarDocumentos, descartarUploads, TIPOS_DOCUMENTO, situacao,
} from '../lib/associado.js';
import { avisarEquipe } from '../lib/avisos.js';

const router = express.Router();
router.use(requireAssociado);

/* ── GET /api/associado/inicio — resumo do painel ── */
router.get('/inicio', async (req, res) => {
  const a = req.associado;
  const ativo = a.status === 'ativo';
  const [[boletos]] = await pool.query(
    `SELECT COUNT(*) AS abertos, SUM(vencimento < CURDATE()) AS vencidos, MIN(vencimento) AS proximo_vencimento
       FROM boletos WHERE associado_id = ? AND status = 'aberto'`, [a.id]);
  const [[recred]] = await pool.query(
    "SELECT id, status, resposta, created_at FROM recredenciamentos WHERE associado_id = ? ORDER BY id DESC LIMIT 1", [a.id]);

  let comunicados = [], classificados = [], naoLidos = 0, meusAnuncios = null;
  if (ativo) {
    [comunicados] = await pool.query(
      `SELECT c.id, c.origem, c.tipo, c.numero, c.titulo, c.resumo, c.data_publicacao, c.destaque,
              (l.associado_id IS NOT NULL) AS lido
         FROM comunicados c
         LEFT JOIN comunicado_leituras l ON l.comunicado_id = c.id AND l.associado_id = ?
        WHERE c.publicado = 1 ORDER BY c.destaque DESC, c.data_publicacao DESC, c.id DESC LIMIT 4`, [a.id]);
    // Só os últimos 90 dias contam como "novos", para associados recém-importados não verem dezenas de pendentes
    [[{ naoLidos }]] = await pool.query(
      `SELECT COUNT(*) AS naoLidos FROM comunicados c
        WHERE c.publicado = 1 AND c.data_publicacao >= CURDATE() - INTERVAL 90 DAY
          AND NOT EXISTS (SELECT 1 FROM comunicado_leituras l WHERE l.comunicado_id = c.id AND l.associado_id = ?)`,
      [a.id]);
    [classificados] = await pool.query(
      `SELECT c.id, c.titulo, c.preco, c.preco_tipo, c.cidade, c.uf, c.tipo,
              (SELECT arquivo FROM classificado_fotos f WHERE f.classificado_id = c.id ORDER BY ordem, id LIMIT 1) AS capa
         FROM classificados c
        WHERE c.status = 'aprovado' AND c.expira_em > NOW()
        ORDER BY c.publicado_em DESC LIMIT 6`);
    [[meusAnuncios]] = await pool.query(
      `SELECT SUM(status = 'aprovado' AND expira_em > NOW()) AS publicados, SUM(status = 'pendente') AS pendentes,
              SUM(status = 'reprovado') AS reprovados
         FROM classificados WHERE associado_id = ?`, [a.id]);
  }

  res.json({
    associado: await serializar(a),
    boletos: { abertos: Number(boletos.abertos) || 0, vencidos: Number(boletos.vencidos) || 0, proximo_vencimento: boletos.proximo_vencimento },
    recredenciamento: recred || null,
    comunicados, comunicados_nao_lidos: Number(naoLidos) || 0,
    classificados: classificados.map(c => ({ ...c, capa: c.capa ? `/uploads/${c.capa}` : null })),
    meus_anuncios: meusAnuncios,
  });
});

/* ── PUT /api/associado/perfil — atualiza contato, endereço e propriedade ── */
router.put('/perfil', async (req, res) => {
  const campos = lerCamposEditaveis(req.body);
  // Preferência de receber avisos (recuperação de senha e respostas do sindicato sempre chegam)
  for (const k of ['aceita_email', 'aceita_whatsapp']) {
    if (req.body[k] !== undefined) campos[k] = req.body[k] === true || req.body[k] === 'true' || req.body[k] === 1 ? 1 : 0;
  }
  if (Object.keys(campos).length) {
    await pool.query('UPDATE associados SET ? WHERE id = ?', [campos, req.associado.id]);
  }
  // Enquanto o cadastro está em análise, o nome ainda pode ser corrigido
  if (req.associado.status === 'pendente' && req.body.nome?.trim()) {
    await pool.query('UPDATE associados SET nome = ? WHERE id = ?', [req.body.nome.trim().slice(0, 160), req.associado.id]);
  }
  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [req.associado.id]);
  res.json({ associado: await serializar(a) });
});

/* ── Documentos ── */
router.get('/documentos', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, tipo, nome_original, mime, tamanho, recredenciamento_id, created_at FROM associado_documentos WHERE associado_id = ? ORDER BY id DESC',
    [req.associado.id]);
  res.json({ documentos: rows, tipos: TIPOS_DOCUMENTO });
});

router.post('/documentos', uploadDocumento.array('documentos', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  await salvarDocumentos(pool, req.associado.id, req.files, req.body.tipos_documentos);
  res.status(201).json({ ok: true });
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  const [[d]] = await pool.query(
    'SELECT arquivo, nome_original FROM associado_documentos WHERE id = ? AND associado_id = ?',
    [req.params.id, req.associado.id]);
  if (!d) return res.status(404).json({ error: 'Documento não encontrado.' });
  enviarPrivado(res, d.arquivo, d.nome_original);
});

router.delete('/documentos/:id', async (req, res) => {
  if (req.associado.status !== 'pendente') {
    return res.status(403).json({ error: 'Após a aprovação, documentos só podem ser removidos pelo sindicato.' });
  }
  const [[d]] = await pool.query('SELECT arquivo FROM associado_documentos WHERE id = ? AND associado_id = ?',
    [req.params.id, req.associado.id]);
  if (!d) return res.status(404).json({ error: 'Documento não encontrado.' });
  await pool.query('DELETE FROM associado_documentos WHERE id = ?', [req.params.id]);
  removerArquivo(d.arquivo, true);
  res.json({ ok: true });
});

/* ── Recredenciamento ── */
router.get('/recredenciamento', requireAssociadoAtivo, async (req, res) => {
  const a = req.associado;
  const [historico] = await pool.query(
    `SELECT id, status, observacao_associado, resposta, validade_anterior, validade_nova, created_at, analisado_em
       FROM recredenciamentos WHERE associado_id = ? ORDER BY id DESC`, [a.id]);
  const cfg = await configuracoes();
  const aviso = Number(cfg.aviso_recredenciamento_dias) || 60;
  const emAndamento = historico.find(r => ['enviado', 'pendencia'].includes(r.status)) || null;
  const janelaAberta = !a.validade_ate || a.validade_ate <= addDias(hojeISO(), aviso);
  res.json({
    situacao: await situacao(a),
    validade_ate: a.validade_ate,
    janela_abre_em: a.validade_ate ? addDias(a.validade_ate, -aviso) : null,
    pode_enviar: janelaAberta && (!emAndamento || emAndamento.status === 'pendencia'),
    em_andamento: emAndamento,
    historico,
    tipos_documento: TIPOS_DOCUMENTO,
  });
});

router.post('/recredenciamento', requireAssociadoAtivo, uploadDocumento.array('documentos', 10), async (req, res) => {
  const a = req.associado;
  const falha = (s, e) => { descartarUploads(req); return res.status(s).json({ error: e }); };
  if (req.body.declaracao !== 'true') return falha(400, 'Confirme a declaração de que os dados são verdadeiros.');

  const cfg = await configuracoes();
  const aviso = Number(cfg.aviso_recredenciamento_dias) || 60;
  if (a.validade_ate && a.validade_ate > addDias(hojeISO(), aviso)) {
    return falha(400, `O recredenciamento abre ${aviso} dias antes do vencimento.`);
  }
  const [[aberto]] = await pool.query(
    "SELECT id, status FROM recredenciamentos WHERE associado_id = ? AND status IN ('enviado','pendencia') ORDER BY id DESC LIMIT 1",
    [a.id]);
  if (aberto?.status === 'enviado') return falha(409, 'Você já tem um recredenciamento em análise.');

  // Os dados atualizados ficam na solicitação e só entram no cadastro após aprovação
  const dados = JSON.stringify(lerCamposEditaveis(JSON.parse(req.body.dados || '{}')));
  const obs = req.body.observacao?.trim().slice(0, 2000) || null;

  await transaction(async conn => {
    let id = aberto?.id;
    if (id) {
      await conn.query(
        "UPDATE recredenciamentos SET status = 'enviado', dados = ?, observacao_associado = ?, created_at = NOW() WHERE id = ?",
        [dados, obs, id]);
    } else {
      const [r] = await conn.query(
        'INSERT INTO recredenciamentos (associado_id, dados, observacao_associado, validade_anterior) VALUES (?, ?, ?, ?)',
        [a.id, dados, obs, a.validade_ate]);
      id = r.insertId;
    }
    await salvarDocumentos(conn, a.id, req.files, req.body.tipos_documentos, id);
  }).catch(err => { descartarUploads(req); throw err; });

  avisarEquipe('equipe_recredenciamento', 'Recredenciamento enviado',
    [`${a.nome} (matrícula ${a.matricula}) enviou o recredenciamento para análise.`], '/admin/recredenciamentos');
  res.status(201).json({ ok: true });
});

/* ── GET /api/associado/carteirinha ── */
router.get('/carteirinha', requireAssociadoAtivo, async (req, res) => {
  const a = req.associado;
  res.json({
    nome: a.nome, matricula: a.matricula, cpf_cnpj: a.cpf_cnpj, tipo_pessoa: a.tipo_pessoa,
    data_filiacao: a.data_filiacao, validade_ate: a.validade_ate, cidade: a.cidade, uf: a.uf,
    codigo_validacao: a.codigo_validacao, situacao: await situacao(a),
  });
});

export default router;
