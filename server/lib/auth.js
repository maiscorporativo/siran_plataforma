import crypto from 'crypto';
import pool from '../db.js';

const DURACAO_HORAS = { associado: 24 * 30, admin: 12 };

export async function criarSessao(tipo, usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + DURACAO_HORAS[tipo] * 3600 * 1000);
  await pool.query(
    'INSERT INTO sessoes (token, tipo, usuario_id, expires_at) VALUES (?, ?, ?, ?)',
    [token, tipo, usuarioId, expira]
  );
  return token;
}

export async function encerrarSessao(token) {
  if (token) await pool.query('DELETE FROM sessoes WHERE token = ?', [token]);
}

export async function encerrarSessoesDoUsuario(tipo, usuarioId, exceto = null) {
  await pool.query(
    'DELETE FROM sessoes WHERE tipo = ? AND usuario_id = ? AND token <> ?',
    [tipo, usuarioId, exceto || '']
  );
}

export function tokenDaRequisicao(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function sessaoValida(req, tipo) {
  const token = tokenDaRequisicao(req);
  if (!token) return null;
  const [rows] = await pool.query(
    'SELECT * FROM sessoes WHERE token = ? AND tipo = ? AND expires_at > NOW() LIMIT 1',
    [token, tipo]
  );
  return rows[0] || null;
}

/* ── Associado logado (qualquer status) ── */
export async function requireAssociado(req, res, next) {
  try {
    const sessao = await sessaoValida(req, 'associado');
    if (!sessao) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    const [rows] = await pool.query('SELECT * FROM associados WHERE id = ? LIMIT 1', [sessao.usuario_id]);
    const a = rows[0];
    if (!a || ['recusado', 'inativo'].includes(a.status)) {
      return res.status(401).json({ error: 'Acesso não permitido.' });
    }
    req.associado = a;
    req.token = sessao.token;
    next();
  } catch (err) {
    next(err);
  }
}

/* ── Associado com filiação aprovada (status ativo) ── */
export function requireAssociadoAtivo(req, res, next) {
  if (req.associado?.status !== 'ativo') {
    return res.status(403).json({
      error: req.associado?.status === 'pendente'
        ? 'Seu cadastro ainda está em análise pelo sindicato.'
        : 'Sua filiação está suspensa. Fale com o sindicato.',
    });
  }
  next();
}

/* ── Associado em dia com o recredenciamento (para publicar anúncios) ── */
export function requireAssociadoRegular(req, res, next) {
  const v = req.associado?.validade_ate;
  if (v && v < hojeISO()) {
    return res.status(403).json({ error: 'Seu credenciamento venceu. Faça o recredenciamento para continuar anunciando.' });
  }
  next();
}

/* ── Equipe do sindicato ── */
export async function requireAdmin(req, res, next) {
  try {
    const sessao = await sessaoValida(req, 'admin');
    if (!sessao) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    const [rows] = await pool.query(
      'SELECT id, nome, email, papel, ativo, trocar_senha FROM admin_usuarios WHERE id = ? LIMIT 1',
      [sessao.usuario_id]
    );
    if (!rows[0] || !rows[0].ativo) return res.status(401).json({ error: 'Acesso não permitido.' });
    req.admin = rows[0];
    req.token = sessao.token;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireMaster(req, res, next) {
  if (req.admin?.papel !== 'master') return res.status(403).json({ error: 'Apenas o usuário master pode fazer isso.' });
  next();
}

/* ── Limite simples de tentativas de login (memória do processo) ── */
const tentativas = new Map();
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 8;

export function limiteLogin(chave) {
  const agora = Date.now();
  const reg = tentativas.get(chave);
  if (reg && agora - reg.inicio < JANELA_MS && reg.n >= MAX_TENTATIVAS) return false;
  return true;
}

export function registrarFalhaLogin(chave) {
  const agora = Date.now();
  const reg = tentativas.get(chave);
  if (!reg || agora - reg.inicio >= JANELA_MS) tentativas.set(chave, { inicio: agora, n: 1 });
  else reg.n++;
  if (tentativas.size > 5000) tentativas.clear();
}

export function limparFalhasLogin(chave) {
  tentativas.delete(chave);
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function gerarSenhaProvisoria() {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, b => alfabeto[b % alfabeto.length]).join('');
}
