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
      return res.status(401).json({ error: 'Seu acesso ainda não foi liberado. Peça uma senha provisória ao sindicato.' });
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
