/* Contas de empresas parceiras, instituições de ensino e candidatos.
   Todas entram com e-mail e senha; sessões separadas por tipo. */
import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import {
  criarSessao, encerrarSessoesDoUsuario, requireOrganizacao, requireCandidato,
  limiteLogin, registrarFalhaLogin, limparFalhasLogin,
} from '../lib/auth.js';
import { txt, soDigitos, cpfValido, cnpjValido, dataISO } from '../lib/util.js';
import { criarTokenSenha, validarTokenSenha, consumirTokenSenha } from '../lib/senhas.js';
import { notificar, statusCanais, link } from '../lib/notificacoes.js';
import { avisarEquipe } from '../lib/avisos.js';

const router = express.Router();
const TIPOS = ['empresa', 'instituicao', 'candidato'];
const SENHA_MIN = 8;
const tabela = tipo => (tipo === 'candidato' ? 'candidatos' : 'organizacoes');

/* Dados da conta sem a senha */
export function publicoConta(tipo, c) {
  if (!c) return null;
  const { senha_hash, ...resto } = c;
  return { ...resto, tipo_conta: tipo, tem_senha: !!senha_hash };
}

async function buscarConta(tipo, email) {
  const sql = tipo === 'candidato'
    ? 'SELECT * FROM candidatos WHERE email = ? LIMIT 1'
    : 'SELECT * FROM organizacoes WHERE email = ? AND tipo = ? LIMIT 1';
  const [[c]] = await pool.query(sql, [email, tipo]);
  return c;
}

router.param('tipo', (req, res, next, tipo) => (TIPOS.includes(tipo) ? next() : res.status(404).json({ error: 'Rota não encontrada.' })));

/* ── Instituições de ensino ativas (para o estudante escolher) ── */
router.get('/instituicoes', async (_req, res) => {
  const [rows] = await pool.query("SELECT id, nome, cidade, uf FROM organizacoes WHERE tipo = 'instituicao' AND status = 'ativa' ORDER BY nome");
  res.json(rows);
});

/* ── Cadastro de empresa parceira (fica pendente de aprovação) ── */
router.post('/empresa/cadastro', async (req, res) => {
  const b = req.body;
  const d = {
    tipo: 'empresa', nome: txt(b.nome, 160), cnpj: soDigitos(b.cnpj), responsavel: txt(b.responsavel, 120), cargo: txt(b.cargo, 80),
    email: txt(b.email, 160)?.toLowerCase(), telefone: soDigitos(b.telefone) || null, whatsapp: soDigitos(b.whatsapp) || null,
    cidade: txt(b.cidade, 80), uf: txt(b.uf, 2)?.toUpperCase() || 'SP', site: txt(b.site, 200), descricao: txt(b.descricao, 3000),
  };
  if (!d.nome) return res.status(400).json({ error: 'Informe o nome da empresa.' });
  if (!cnpjValido(d.cnpj)) return res.status(400).json({ error: 'CNPJ inválido.' });
  if (!d.responsavel) return res.status(400).json({ error: 'Informe o nome do responsável.' });
  if (!d.email?.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!d.whatsapp && !d.telefone) return res.status(400).json({ error: 'Informe um telefone ou WhatsApp.' });
  if (String(b.senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  if (b.aceite !== true && b.aceite !== 'true') return res.status(400).json({ error: 'É preciso aceitar os termos de uso.' });
  const [[dup]] = await pool.query("SELECT id FROM organizacoes WHERE email = ? OR (cnpj = ? AND tipo = 'empresa')", [d.email, d.cnpj]);
  if (dup) return res.status(409).json({ error: 'Já existe cadastro com este e-mail ou CNPJ. Use "Entrar" ou "Esqueci a senha".' });
  // Empresa que já é associada deve usar a Área do Associado
  const [[assoc]] = await pool.query("SELECT id FROM associados WHERE cpf_cnpj = ? AND status = 'ativo'", [d.cnpj]);
  if (assoc) return res.status(409).json({ error: 'Este CNPJ é de um associado do SIRAN. Publique suas vagas pela Área do Associado.' });
  const [r] = await pool.query('INSERT INTO organizacoes SET ?', [{
    ...d, status: 'pendente', senha_hash: await bcrypt.hash(b.senha, 10), aceite_termos_em: new Date(),
  }]);
  avisarEquipe('equipe_nova_empresa', 'Nova empresa pediu cadastro para publicar vagas',
    [`${d.nome} (${d.cidade || 'cidade não informada'}) pediu acesso para publicar vagas de emprego e estágio.`], '/admin/organizacoes');
  const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [r.insertId]);
  res.status(201).json({ token: await criarSessao('empresa', o.id), conta: publicoConta('empresa', o) });
});

/* ── Cadastro de candidato (ativo na hora) ── */
router.post('/candidato/cadastro', async (req, res) => {
  const b = req.body;
  const d = {
    nome: txt(b.nome, 160), cpf: soDigitos(b.cpf), email: txt(b.email, 160)?.toLowerCase(), whatsapp: soDigitos(b.whatsapp) || null,
    cidade: txt(b.cidade, 80), uf: txt(b.uf, 2)?.toUpperCase() || 'SP', data_nascimento: dataISO(b.data_nascimento),
  };
  if (!d.nome || d.nome.split(/\s+/).length < 2) return res.status(400).json({ error: 'Informe o nome completo.' });
  if (!cpfValido(d.cpf)) return res.status(400).json({ error: 'CPF inválido.' });
  if (!d.email?.includes('@')) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (String(b.senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  if (b.aceite !== true && b.aceite !== 'true') return res.status(400).json({ error: 'É preciso aceitar os termos de uso.' });
  const [[dup]] = await pool.query('SELECT id FROM candidatos WHERE email = ? OR cpf = ?', [d.email, d.cpf]);
  if (dup) return res.status(409).json({ error: 'Já existe cadastro com este e-mail ou CPF. Use "Entrar" ou "Esqueci a senha".' });
  const [r] = await pool.query('INSERT INTO candidatos SET ?', [{ ...d, senha_hash: await bcrypt.hash(b.senha, 10), aceite_termos_em: new Date() }]);
  const [[c]] = await pool.query('SELECT * FROM candidatos WHERE id = ?', [r.insertId]);
  res.status(201).json({ token: await criarSessao('candidato', c.id), conta: publicoConta('candidato', c) });
});

/* ── Login (e-mail e senha) ── */
router.post('/:tipo/login', async (req, res) => {
  const { tipo } = req.params;
  const email = String(req.body.email || '').trim().toLowerCase();
  const chave = `${tipo}:${req.ip}:${email}`;
  if (!limiteLogin(chave)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  const c = await buscarConta(tipo, email);
  if (!c || !c.senha_hash || !(await bcrypt.compare(String(req.body.senha || ''), c.senha_hash))) {
    registrarFalhaLogin(chave);
    if (c && !c.senha_hash) return res.status(401).json({ error: 'Você ainda não criou sua senha. Use o link recebido por e-mail ou "Esqueci a senha".' });
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  if (['recusada', 'suspensa'].includes(c.status)) {
    return res.status(403).json({ error: `Acesso não liberado${c.motivo_status ? `: ${c.motivo_status}` : '.'} Fale com o SIRAN.` });
  }
  limparFalhasLogin(chave);
  await pool.query(`UPDATE ${tabela(tipo)} SET ultimo_login = NOW() WHERE id = ?`, [c.id]);
  res.json({ token: await criarSessao(tipo, c.id), conta: publicoConta(tipo, c) });
});

const requireConta = tipo => (tipo === 'candidato' ? requireCandidato : requireOrganizacao(tipo));
const contaDaReq = (req, tipo) => (tipo === 'candidato' ? req.candidato : req.organizacao);

router.get('/:tipo/me', (req, res, next) => requireConta(req.params.tipo)(req, res, next), (req, res) => {
  res.json({ conta: publicoConta(req.params.tipo, contaDaReq(req, req.params.tipo)) });
});

router.post('/:tipo/trocar-senha', (req, res, next) => requireConta(req.params.tipo)(req, res, next), async (req, res) => {
  const { tipo } = req.params;
  const c = contaDaReq(req, tipo);
  if (String(req.body.nova_senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A nova senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  if (!(await bcrypt.compare(String(req.body.senha_atual || ''), c.senha_hash || ''))) return res.status(400).json({ error: 'Senha atual incorreta.' });
  await pool.query(`UPDATE ${tabela(tipo)} SET senha_hash = ? ${tipo === 'candidato' ? '' : ', trocar_senha = 0'} WHERE id = ?`, [await bcrypt.hash(req.body.nova_senha, 10), c.id]);
  await encerrarSessoesDoUsuario(tipo, c.id, req.token);
  res.json({ ok: true });
});

/* ── Recuperação de senha por e-mail ── */
router.post('/:tipo/recuperar', async (req, res) => {
  const { tipo } = req.params;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!limiteLogin(`rec${tipo}:${req.ip}`)) return res.status(429).json({ error: 'Muitas solicitações. Aguarde 15 minutos.' });
  registrarFalhaLogin(`rec${tipo}:${req.ip}`);
  const c = await buscarConta(tipo, email);
  const canais = statusCanais();
  // Mesma resposta exista ou não a conta
  if (c && canais.email && canais.app_url && !['recusada', 'suspensa'].includes(c.status)) {
    const token = await criarTokenSenha(tipo, c.id, 1);
    await notificar({
      evento: `recuperar_senha_${tipo}`, para: { email: c.email, whatsapp: tipo === 'candidato' ? c.whatsapp : null }, essencial: true,
      titulo: 'Redefinição de senha — SIRAN',
      paragrafos: ['Use o link abaixo para criar uma nova senha. Ele vale por 1 hora.', 'Se não foi você, ignore esta mensagem.'],
      botao: { texto: 'Redefinir senha', url: link(`/conta/redefinir?tipo=${tipo}&t=${token}`) },
    });
  }
  res.json({ ok: true, email_ativo: canais.email && !!canais.app_url });
});

router.get('/:tipo/redefinir/:token', async (req, res) => {
  const id = await validarTokenSenha(req.params.tipo, req.params.token);
  if (!id) return res.status(410).json({ error: 'Este link expirou ou já foi usado. Peça um novo.' });
  const [[c]] = await pool.query(`SELECT nome, senha_hash FROM ${tabela(req.params.tipo)} WHERE id = ?`, [id]);
  res.json({ nome: c.nome, primeiro_acesso: !c.senha_hash });
});

router.post('/:tipo/redefinir', async (req, res) => {
  const { tipo } = req.params;
  const { token, nova_senha } = req.body;
  if (String(nova_senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
  const id = await validarTokenSenha(tipo, token);
  if (!id) return res.status(410).json({ error: 'Este link expirou ou já foi usado. Peça um novo.' });
  await consumirTokenSenha(token);
  await pool.query(`UPDATE ${tabela(tipo)} SET senha_hash = ?, ultimo_login = NOW() WHERE id = ?`, [await bcrypt.hash(nova_senha, 10), id]);
  await encerrarSessoesDoUsuario(tipo, id);
  const [[c]] = await pool.query(`SELECT * FROM ${tabela(tipo)} WHERE id = ?`, [id]);
  res.json({ token: await criarSessao(tipo, id), conta: publicoConta(tipo, c) });
});

export default router;
