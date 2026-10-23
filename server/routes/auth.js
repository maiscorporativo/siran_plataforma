import express from 'express';
import bcrypt from 'bcryptjs';
import pool, { transaction } from '../db.js';
import {
  criarSessao, encerrarSessao, encerrarSessoesDoUsuario, tokenDaRequisicao,
  requireAssociado, requireAdmin, limiteLogin, registrarFalhaLogin, limparFalhasLogin,
} from '../lib/auth.js';
import { soDigitos, documentoValido, txt } from '../lib/util.js';
import { uploadDocumento } from '../lib/storage.js';
import {
  lerCamposEditaveis, serializar, salvarDocumentos, descartarUploads, novoCodigoValidacao,
} from '../lib/associado.js';
import { criarTokenSenha, validarTokenSenha, consumirTokenSenha, mascararEmail, mascararTelefone } from '../lib/senhas.js';
import { notificar, destinoAssociado, statusCanais, link } from '../lib/notificacoes.js';
import { avisarEquipe } from '../lib/avisos.js';

const router = express.Router();
const SENHA_MIN = 8;

/* ── POST /api/auth/login — associado entra com CPF/CNPJ ── */
router.post('/login', async (req, res) => {
  const documento = soDigitos(req.body.documento);
  const senha = String(req.body.senha || '');
  const chave = `a:${req.ip}:${documento}`;
  if (!limiteLogin(chave)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  if (!documento || !senha) return res.status(400).json({ error: 'Informe CPF/CNPJ e senha.' });

  const [rows] = await pool.query('SELECT * FROM associados WHERE cpf_cnpj = ? LIMIT 1', [documento]);
  const a = rows[0];
  if (!a || !a.senha_hash || !(await bcrypt.compare(senha, a.senha_hash))) {
    registrarFalhaLogin(chave);
    if (a && !a.senha_hash) {
      return res.status(401).json({ error: 'Você ainda não criou sua senha. Use "Primeiro acesso / esqueci a senha" logo abaixo.' });
    }
    return res.status(401).json({ error: 'CPF/CNPJ ou senha inválidos.' });
  }
  if (a.status === 'inativo') return res.status(403).json({ error: 'Cadastro inativo. Fale com o sindicato.' });
  if (a.status === 'recusado') {
    return res.status(403).json({ error: `Cadastro não aprovado${a.motivo_status ? `: ${a.motivo_status}` : '.'} Fale com o sindicato.` });
  }
  limparFalhasLogin(chave);
  await pool.query('UPDATE associados SET ultimo_login = NOW() WHERE id = ?', [a.id]);
  const token = await criarSessao('associado', a.id);
  res.json({ token, associado: await serializar(a) });
});

/* ── POST /api/auth/cadastro — pedido de filiação (com documentos) ── */
router.post('/cadastro', uploadDocumento.array('documentos', 10), async (req, res) => {
  const b = req.body;
  const falha = (status, error) => { descartarUploads(req); return res.status(status).json({ error }); };

  const documento = soDigitos(b.cpf_cnpj);
  const tipoPessoa = documento.length === 14 ? 'PJ' : 'PF';
  const nome = txt(b.nome, 160);
  const senha = String(b.senha || '');

  if (!nome) return falha(400, 'Informe o nome completo.');
  if (!documentoValido(documento)) return falha(400, 'CPF ou CNPJ inválido.');
  if (senha.length < SENHA_MIN) return falha(400, `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
  if (b.aceite_termos !== 'true' && b.aceite_termos !== true) {
    return falha(400, 'É preciso aceitar os termos de uso e a política de privacidade.');
  }
  const campos = lerCamposEditaveis(b);
  if (!campos.whatsapp && !campos.telefone) return falha(400, 'Informe um telefone ou WhatsApp.');
  if (!campos.cidade) return falha(400, 'Informe a cidade.');

  const [existe] = await pool.query('SELECT id, status FROM associados WHERE cpf_cnpj = ? LIMIT 1', [documento]);
  if (existe.length) {
    return falha(409, existe[0].status === 'pendente'
      ? 'Já existe um pedido de filiação para este CPF/CNPJ em análise. Entre com sua senha para acompanhar.'
      : 'Este CPF/CNPJ já está cadastrado. Use "Entrar" ou fale com o sindicato.');
  }

  const id = await transaction(async conn => {
    const dados = {
      ...campos, nome, cpf_cnpj: documento, tipo_pessoa: tipoPessoa, status: 'pendente',
      senha_hash: await bcrypt.hash(senha, 10), aceite_termos_em: new Date(),
      codigo_validacao: novoCodigoValidacao(),
    };
    const [r] = await conn.query('INSERT INTO associados SET ?', [dados]);
    await salvarDocumentos(conn, r.insertId, req.files, b.tipos_documentos);
    return r.insertId;
  }).catch(err => { descartarUploads(req); throw err; });

  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [id]);
  const token = await criarSessao('associado', id);
  avisarEquipe('equipe_nova_filiacao', 'Novo pedido de filiação',
    [`${a.nome} (${a.cidade || 'cidade não informada'}) enviou um pedido de filiação pela Área do Associado.`], `/admin/associados/${id}`);
  res.status(201).json({ token, associado: await serializar(a) });
});

/* ── GET /api/auth/me ── */
router.get('/me', requireAssociado, async (req, res) => {
  res.json({ associado: await serializar(req.associado) });
});

/* ── POST /api/auth/trocar-senha — associado ── */
router.post('/trocar-senha', requireAssociado, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (String(nova_senha || '').length < SENHA_MIN) {
    return res.status(400).json({ error: `A nova senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  }
  if (!(await bcrypt.compare(String(senha_atual || ''), req.associado.senha_hash || ''))) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  await pool.query('UPDATE associados SET senha_hash = ?, trocar_senha = 0 WHERE id = ?',
    [await bcrypt.hash(nova_senha, 10), req.associado.id]);
  await encerrarSessoesDoUsuario('associado', req.associado.id, req.token);
  res.json({ ok: true });
});

/* ════════════ Recuperação de senha / primeiro acesso ════════════ */

/* ── POST /api/auth/recuperar — envia link por e-mail e WhatsApp ── */
router.post('/recuperar', async (req, res) => {
  const documento = soDigitos(req.body.documento);
  const chave = `rec:${req.ip}`;
  if (!limiteLogin(chave) || !limiteLogin(`rec:${documento}`)) {
    return res.status(429).json({ error: 'Muitas solicitações. Aguarde 15 minutos e tente de novo.' });
  }
  registrarFalhaLogin(chave);
  registrarFalhaLogin(`rec:${documento}`);
  if (!documentoValido(documento)) return res.status(400).json({ error: 'Informe um CPF ou CNPJ válido.' });

  const [[a]] = await pool.query('SELECT * FROM associados WHERE cpf_cnpj = ? LIMIT 1', [documento]);
  if (!a) return res.status(404).json({ error: 'Não encontramos cadastro com este CPF/CNPJ. Se quiser se associar, use "Quero me associar".' });
  if (['recusado', 'inativo'].includes(a.status)) {
    return res.status(403).json({ error: 'Este cadastro não está ativo. Fale com o sindicato.' });
  }

  const canais = statusCanais();
  // O link precisa do endereço oficial (APP_URL); nunca usamos o Host da requisição, que pode ser forjado
  if (!canais.app_url) {
    return res.json({ enviado: false, mensagem: 'A recuperação automática ainda não está configurada. Fale com o sindicato para liberar seu acesso.' });
  }
  const temEmail = canais.email && a.email;
  const temWhats = canais.whatsapp && (a.whatsapp || a.telefone);
  if (!temEmail && !temWhats) {
    return res.json({ enviado: false, mensagem: 'Não há e-mail ou WhatsApp cadastrado para receber o link. Fale com o sindicato para liberar seu acesso.' });
  }

  const token = await criarTokenSenha('associado', a.id, 1);
  const primeiro = !a.senha_hash;
  const usados = await notificar({
    evento: 'recuperar_senha', para: destinoAssociado(a), essencial: true,
    titulo: primeiro ? 'Crie sua senha de acesso' : 'Redefinição de senha',
    paragrafos: [
      `Olá, ${a.nome.split(' ')[0]}! Recebemos um pedido para ${primeiro ? 'criar' : 'redefinir'} a senha da sua Área do Associado do SIRAN.`,
      'Toque no link abaixo para escolher a nova senha. Ele vale por 1 hora.',
      'Se não foi você, ignore esta mensagem: sua senha atual continua valendo.',
    ],
    botao: { texto: primeiro ? 'Criar minha senha' : 'Redefinir senha', url: link(`/redefinir-senha?t=${token}`) },
  });
  res.json({
    enviado: true,
    email: usados.email ? mascararEmail(usados.email) : null,
    whatsapp: usados.whatsapp ? mascararTelefone(usados.whatsapp) : null,
  });
});

/* ── GET /api/auth/redefinir/:token — confere o link antes de mostrar o formulário ── */
router.get('/redefinir/:token', async (req, res) => {
  const id = await validarTokenSenha('associado', req.params.token);
  if (!id) return res.status(410).json({ error: 'Este link expirou ou já foi usado. Peça um novo.' });
  const [[a]] = await pool.query('SELECT nome, senha_hash FROM associados WHERE id = ?', [id]);
  res.json({ nome: a.nome.split(' ')[0], primeiro_acesso: !a.senha_hash });
});

/* ── POST /api/auth/redefinir — grava a nova senha e já entra ── */
router.post('/redefinir', async (req, res) => {
  const { token, nova_senha } = req.body;
  if (String(nova_senha || '').length < SENHA_MIN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  }
  const id = await validarTokenSenha('associado', token);
  if (!id) return res.status(410).json({ error: 'Este link expirou ou já foi usado. Peça um novo.' });
  await consumirTokenSenha(token);
  await pool.query('UPDATE associados SET senha_hash = ?, trocar_senha = 0, ultimo_login = NOW() WHERE id = ?',
    [await bcrypt.hash(nova_senha, 10), id]);
  await encerrarSessoesDoUsuario('associado', id);
  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [id]);
  res.json({ token: await criarSessao('associado', id), associado: await serializar(a) });
});

/* ── Equipe: recuperação só por e-mail ── */
router.post('/admin/recuperar', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!limiteLogin(`recadm:${req.ip}`)) return res.status(429).json({ error: 'Muitas solicitações. Aguarde 15 minutos.' });
  registrarFalhaLogin(`recadm:${req.ip}`);
  const [[u]] = await pool.query('SELECT id, nome, email FROM admin_usuarios WHERE email = ? AND ativo = 1', [email]);
  // Resposta igual exista ou não o e-mail, para não revelar quem é da equipe
  if (u && statusCanais().email && statusCanais().app_url) {
    const token = await criarTokenSenha('admin', u.id, 1);
    await notificar({
      evento: 'recuperar_senha_admin', para: { email: u.email }, essencial: true,
      titulo: 'Redefinição de senha — Gestão SIRAN',
      paragrafos: [`Olá, ${u.nome.split(' ')[0]}. Use o link abaixo para criar uma nova senha do painel de gestão. Ele vale por 1 hora.`, 'Se não foi você, ignore esta mensagem.'],
      botao: { texto: 'Redefinir senha', url: link(`/admin/redefinir-senha?t=${token}`) },
    });
  }
  res.json({ ok: true, email_ativo: statusCanais().email });
});

router.post('/admin/redefinir', async (req, res) => {
  const { token, nova_senha } = req.body;
  if (String(nova_senha || '').length < SENHA_MIN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  }
  const id = await validarTokenSenha('admin', token);
  if (!id) return res.status(410).json({ error: 'Este link expirou ou já foi usado. Peça um novo.' });
  await consumirTokenSenha(token);
  await pool.query('UPDATE admin_usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?', [await bcrypt.hash(nova_senha, 10), id]);
  await encerrarSessoesDoUsuario('admin', id);
  res.json({ ok: true });
});

/* ── POST /api/auth/logout — vale para associado e equipe ── */
router.post('/logout', async (req, res) => {
  await encerrarSessao(tokenDaRequisicao(req));
  res.json({ ok: true });
});

/* ════════════ Equipe do sindicato ════════════ */

router.post('/admin/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  const chave = `adm:${req.ip}:${email}`;
  if (!limiteLogin(chave)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });

  const [rows] = await pool.query('SELECT * FROM admin_usuarios WHERE email = ? LIMIT 1', [email]);
  const u = rows[0];
  if (!u || !u.ativo || !(await bcrypt.compare(senha, u.senha_hash))) {
    registrarFalhaLogin(chave);
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  limparFalhasLogin(chave);
  await pool.query('UPDATE admin_usuarios SET ultimo_login = NOW() WHERE id = ?', [u.id]);
  const token = await criarSessao('admin', u.id);
  res.json({ token, admin: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, trocar_senha: u.trocar_senha } });
});

router.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

router.post('/admin/trocar-senha', requireAdmin, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (String(nova_senha || '').length < SENHA_MIN) {
    return res.status(400).json({ error: `A nova senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  }
  const [[u]] = await pool.query('SELECT senha_hash FROM admin_usuarios WHERE id = ?', [req.admin.id]);
  if (!(await bcrypt.compare(String(senha_atual || ''), u.senha_hash))) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  await pool.query('UPDATE admin_usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?',
    [await bcrypt.hash(nova_senha, 10), req.admin.id]);
  await encerrarSessoesDoUsuario('admin', req.admin.id, req.token);
  res.json({ ok: true });
});

export default router;
