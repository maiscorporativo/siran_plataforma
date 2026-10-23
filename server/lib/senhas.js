import crypto from 'crypto';
import pool from '../db.js';

const hash = token => crypto.createHash('sha256').update(token).digest('hex');

/* Cria um link de redefinição; invalida os anteriores do mesmo usuário */
export async function criarTokenSenha(tipo, usuarioId, horas = 1) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('UPDATE senha_tokens SET usado_em = NOW() WHERE tipo = ? AND usuario_id = ? AND usado_em IS NULL', [tipo, usuarioId]);
  await pool.query(
    'INSERT INTO senha_tokens (token_hash, tipo, usuario_id, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL ? HOUR)',
    [hash(token), tipo, usuarioId, horas]);
  return token;
}

/* Retorna o id do usuário se o token for válido (sem consumir) */
export async function validarTokenSenha(tipo, token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const [[t]] = await pool.query(
    'SELECT usuario_id FROM senha_tokens WHERE token_hash = ? AND tipo = ? AND usado_em IS NULL AND expires_at > NOW()',
    [hash(token), tipo]);
  return t?.usuario_id ?? null;
}

export async function consumirTokenSenha(token) {
  await pool.query('UPDATE senha_tokens SET usado_em = NOW() WHERE token_hash = ?', [hash(token)]);
}

/* Mostra só parte do destino: j***@gmail.com, (18) *****-1234 */
export function mascararEmail(e) {
  if (!e) return null;
  const [u, d] = e.split('@');
  return `${u.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(u.length - 1, 5)))}@${d}`;
}

export function mascararTelefone(t) {
  if (!t) return null;
  const d = String(t).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
}
