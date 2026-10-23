import pool from '../db.js';

export const soDigitos = v => String(v ?? '').replace(/\D/g, '');

export function cpfValido(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

export function cnpjValido(v) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = len => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function documentoValido(v) {
  const d = soDigitos(v);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

/* Texto opcional: string vazia vira null, com limite de tamanho */
export function txt(v, max = 255) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* Aceita "1.234,56", "1234.56" e números */
export function dinheiro(v) {
  if (typeof v === 'number') return v;
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().replace(/^R\$\s*/, '');
  // "1.500" e "85.000" são milhares no padrão brasileiro, não decimais
  const milhar = /^\d{1,3}(\.\d{3})+$/.test(s);
  const n = s.includes(',') || milhar ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function dataISO(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export const bool = v => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);

export function addMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + meses, d));
  // Ajusta fim de mês (ex.: 31/01 + 1 mês → 28/02)
  if (dt.getUTCDate() !== d) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

export function addDias(iso, dias) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

/* Lê uma planilha CSV (separador ; ou ,) em lista de objetos com cabeçalho normalizado */
export function lerCSV(buffer) {
  let texto = buffer.toString('utf8');
  if (texto.includes('�')) texto = buffer.toString('latin1');
  texto = texto.replace(/^﻿/, '');
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const parse = linha => {
    const out = [];
    let atual = '', aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
      } else if (ch === sep && !aspas) { out.push(atual.trim()); atual = ''; }
      else atual += ch;
    }
    out.push(atual.trim());
    return out;
  };
  const norm = h => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const cab = parse(linhas[0]).map(norm);
  return linhas.slice(1).map(l => {
    const vals = parse(l);
    return Object.fromEntries(cab.map((h, i) => [h, vals[i] ?? '']));
  });
}

export async function registrarAcao(adminId, acao, entidade, entidadeId, detalhes = null) {
  try {
    await pool.query(
      'INSERT INTO log_acoes (admin_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?)',
      [adminId, acao, entidade, entidadeId, detalhes ? String(detalhes).slice(0, 500) : null]
    );
  } catch (err) {
    console.warn('[log_acoes]', err.message);
  }
}

let cacheConfig = null;
export async function configuracoes() {
  if (cacheConfig) return cacheConfig;
  const [rows] = await pool.query('SELECT chave, valor FROM configuracoes');
  cacheConfig = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
  return cacheConfig;
}
export function limparCacheConfig() {
  cacheConfig = null;
}

/* Paginação padrão: ?pagina=1&por_pagina=20 */
export function paginacao(query, padrao = 20) {
  const porPagina = Math.min(Math.max(Number(query.por_pagina) || padrao, 1), 100);
  const pagina = Math.max(Number(query.pagina) || 1, 1);
  return { limite: porPagina, offset: (pagina - 1) * porPagina, pagina, porPagina };
}

/* Escapa curingas do LIKE */
export const like = v => `%${String(v).replace(/[\\%_]/g, m => '\\' + m)}%`;
