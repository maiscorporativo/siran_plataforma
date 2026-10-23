import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../db.js';
import { requireAdmin, requireMaster, gerarSenhaProvisoria, encerrarSessoesDoUsuario } from '../../lib/auth.js';
import { txt, configuracoes, limparCacheConfig, registrarAcao } from '../../lib/util.js';
import { CONFIG_PADRAO } from '../../migrate.js';
import { statusCanais, diagnosticar, enviarTeste } from '../../lib/notificacoes.js';
import { enviarLembretes } from '../../lib/avisos.js';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { storageDir, publicoDir, privadoDir } from '../../lib/storage.js';
import associados, { contarVencendo } from './associados.js';
import recredenciamentos from './recredenciamentos.js';
import classificados from './classificados.js';
import conveniados from './conveniados.js';
import categorias from './categorias.js';
import boletos from './boletos.js';
import comunicados from './comunicados.js';

const router = express.Router();
router.use(requireAdmin);

router.use('/associados', associados);
router.use('/recredenciamentos', recredenciamentos);
router.use('/classificados', classificados);
router.use('/conveniados', conveniados);
router.use('/categorias', categorias);
router.use('/boletos', boletos);
router.use('/comunicados', comunicados);

/* ── GET /api/admin/painel — pendências e números gerais ── */
router.get('/painel', async (_req, res) => {
  const cfg = await configuracoes();
  const [[assoc]] = await pool.query(
    `SELECT SUM(status = 'ativo') AS ativos, SUM(status = 'pendente') AS pendentes,
            SUM(status = 'ativo' AND validade_ate < CURDATE()) AS vencidos,
            SUM(status = 'suspenso') AS suspensos
       FROM associados`);
  const [[{ recred }]] = await pool.query("SELECT COUNT(*) AS recred FROM recredenciamentos WHERE status = 'enviado'");
  const [[{ anuncios }]] = await pool.query("SELECT COUNT(*) AS anuncios FROM classificados WHERE status = 'pendente'");
  const [[{ publicados }]] = await pool.query("SELECT COUNT(*) AS publicados FROM classificados WHERE status = 'aprovado' AND expira_em > NOW()");
  const [[fin]] = await pool.query(
    `SELECT SUM(status = 'aberto' AND vencimento < CURDATE()) AS vencidos,
            COUNT(DISTINCT CASE WHEN status = 'aberto' AND vencimento < CURDATE() THEN associado_id END) AS inadimplentes,
            COALESCE(SUM(CASE WHEN status = 'pago' AND pago_em >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN COALESCE(valor_pago, valor) END), 0) AS recebido_mes
       FROM boletos`);
  const [[{ conveniados: conv }]] = await pool.query('SELECT COUNT(*) AS conveniados FROM conveniados WHERE ativo = 1');
  const [pendentes] = await pool.query(
    "SELECT id, nome, cidade, created_at FROM associados WHERE status = 'pendente' ORDER BY created_at LIMIT 5");
  const aviso = Number(cfg.aviso_recredenciamento_dias) || 60;

  res.json({
    associados: {
      ativos: Number(assoc.ativos) || 0, pendentes: Number(assoc.pendentes) || 0,
      vencidos: Number(assoc.vencidos) || 0, suspensos: Number(assoc.suspensos) || 0,
      vencendo: await contarVencendo(aviso), aviso_dias: aviso,
    },
    recredenciamentos_pendentes: recred,
    anuncios_pendentes: anuncios,
    anuncios_publicados: publicados,
    conveniados: conv,
    financeiro: { boletos_vencidos: Number(fin.vencidos) || 0, inadimplentes: Number(fin.inadimplentes) || 0, recebido_mes: Number(fin.recebido_mes) || 0 },
    cadastros_recentes: pendentes,
  });
});

/* ── Configurações ── */
router.get('/configuracoes', async (_req, res) => {
  res.json(await configuracoes());
});

router.put('/configuracoes', requireMaster, async (req, res) => {
  for (const chave of Object.keys(CONFIG_PADRAO)) {
    if (req.body[chave] === undefined) continue;
    await pool.query('INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [chave, txt(req.body[chave], 500)]);
  }
  limparCacheConfig();
  await registrarAcao(req.admin.id, 'configuracoes', 'sistema', null);
  res.json(await configuracoes());
});

/* ── Envios automáticos: situação dos canais, teste e histórico ── */
router.get('/notificacoes', async (req, res) => {
  const [log] = await pool.query(
    `SELECT n.id, n.evento, n.canal, n.destino, n.status, n.erro, n.created_at, n.enviado_em, a.nome
       FROM notificacoes_log n LEFT JOIN associados a ON a.id = n.associado_id
      ORDER BY n.id DESC LIMIT 100`);
  const [[resumo]] = await pool.query(
    `SELECT SUM(status = 'enviado') AS enviados, SUM(status = 'falha') AS falhas, SUM(status = 'pendente') AS pendentes
       FROM notificacoes_log WHERE created_at >= NOW() - INTERVAL 30 DAY`);
  res.json({ canais: statusCanais(), diagnostico: req.query.diagnostico === '1' ? await diagnosticar() : null, resumo, log });
});

router.post('/notificacoes/teste', requireMaster, async (req, res) => {
  const email = txt(req.body.email, 160);
  const whatsapp = txt(req.body.whatsapp, 20);
  if (!email && !whatsapp) return res.status(400).json({ error: 'Informe um e-mail ou WhatsApp.' });
  res.json(await enviarTeste({ email, whatsapp }));
});

router.post('/notificacoes/lembretes', requireMaster, async (_req, res) => {
  res.json({ enfileirados: await enviarLembretes() });
});

/* ── Armazenamento: onde os arquivos ficam e se dá para gravar ── */
function contarArquivos(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .reduce((n, e) => n + (e.isDirectory() ? contarArquivos(path.join(dir, e.name)) : 1), 0);
  } catch { return 0; }
}

router.get('/armazenamento', requireMaster, (_req, res) => {
  const gravavel = [publicoDir, privadoDir].every(d => {
    const teste = path.join(d, `.teste-${Date.now()}`);
    try { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(teste, 'ok'); fs.unlinkSync(teste); return true; } catch { return false; }
  });
  res.json({ pasta: storageDir, gravavel, arquivos: { publico: contarArquivos(publicoDir), privado: contarArquivos(privadoDir) } });
});

/* ── Pacote .zip com arquivos (ex.: fotos e PDFs da demonstração) ──
   Aceita só caminhos publico|privado/<subpasta conhecida>/<arquivo>. */
const SUBPASTAS = /^(publico\/(anuncios|conveniados)|privado\/(boletos|comunicados|documentos))\/[\w.-]+$/;
const uploadPacote = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

router.post('/armazenamento/pacote', requireMaster, uploadPacote.single('pacote'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie o arquivo .zip.' });
  let zip;
  try { zip = new AdmZip(req.file.buffer); } catch { return res.status(400).json({ error: 'Arquivo .zip inválido.' }); }
  let gravados = 0;
  const ignorados = [];
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const nome = e.entryName.replace(/\\/g, '/').replace(/^\.?\/+/, '');
    if (!SUBPASTAS.test(nome) || nome.includes('..')) { ignorados.push(nome); continue; }
    const destino = path.join(storageDir, nome);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, e.getData());
    gravados++;
  }
  registrarAcao(req.admin.id, 'pacote_arquivos', 'sistema', null, `${gravados} arquivos`);
  res.json({ gravados, ignorados });
});

/* ── Usuários da equipe (somente master) ── */
router.get('/usuarios', requireMaster, async (_req, res) => {
  const [rows] = await pool.query('SELECT id, nome, email, papel, ativo, ultimo_login, created_at FROM admin_usuarios ORDER BY nome');
  res.json(rows);
});

router.post('/usuarios', requireMaster, async (req, res) => {
  const nome = txt(req.body.nome, 120);
  const email = txt(req.body.email, 160)?.toLowerCase();
  if (!nome || !email || !email.includes('@')) return res.status(400).json({ error: 'Informe nome e e-mail válidos.' });
  const papel = req.body.papel === 'master' ? 'master' : 'admin';
  const senha = gerarSenhaProvisoria();
  try {
    const [r] = await pool.query(
      'INSERT INTO admin_usuarios (nome, email, senha_hash, papel, trocar_senha) VALUES (?, ?, ?, ?, 1)',
      [nome, email, await bcrypt.hash(senha, 10), papel]);
    res.status(201).json({ id: r.insertId, senha });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
    throw err;
  }
});

router.put('/usuarios/:id', requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  const papel = req.body.papel === 'master' ? 'master' : 'admin';
  const ativo = req.body.ativo ? 1 : 0;
  if (id === req.admin.id && (!ativo || papel !== 'master')) {
    return res.status(400).json({ error: 'Você não pode rebaixar ou desativar a si mesmo.' });
  }
  await pool.query('UPDATE admin_usuarios SET nome = ?, papel = ?, ativo = ? WHERE id = ?',
    [txt(req.body.nome, 120), papel, ativo, id]);
  if (!ativo) await encerrarSessoesDoUsuario('admin', id);
  res.json({ ok: true });
});

router.post('/usuarios/:id/senha-provisoria', requireMaster, async (req, res) => {
  const senha = gerarSenhaProvisoria();
  const [r] = await pool.query('UPDATE admin_usuarios SET senha_hash = ?, trocar_senha = 1 WHERE id = ?',
    [await bcrypt.hash(senha, 10), req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Usuário não encontrado.' });
  await encerrarSessoesDoUsuario('admin', Number(req.params.id));
  res.json({ senha });
});

export default router;
