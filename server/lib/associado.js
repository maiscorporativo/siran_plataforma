import fs from 'fs';
import crypto from 'crypto';
import pool from '../db.js';
import { hojeISO } from './auth.js';
import { configuracoes, addDias, txt, num, soDigitos, dataISO } from './util.js';

/* Campos que o próprio associado pode atualizar (cadastro, perfil e recredenciamento) */
export const CAMPOS_EDITAVEIS = {
  rg_ie: 30, email: 160, telefone: 20, whatsapp: 20,
  cep: 8, logradouro: 160, numero: 20, complemento: 80, bairro: 80, cidade: 80, uf: 2,
  propriedade_nome: 160, propriedade_municipio: 80, atividades: 255,
  inscricao_produtor: 30, car: 60, ccir: 30,
};

export const TIPOS_DOCUMENTO = {
  identidade: 'RG / CNH',
  cpf_cnpj: 'Cartão CPF / CNPJ',
  comprovante_endereco: 'Comprovante de endereço',
  inscricao_produtor: 'Inscrição de produtor rural',
  ccir: 'CCIR',
  car: 'CAR',
  contrato_social: 'Contrato social',
  itr: 'ITR',
  outro: 'Outro',
};

/* Normaliza os campos editáveis vindos do formulário */
export function lerCamposEditaveis(body) {
  const out = {};
  for (const [campo, max] of Object.entries(CAMPOS_EDITAVEIS)) {
    if (body[campo] === undefined) continue;
    let v = txt(body[campo], max);
    if (v && ['telefone', 'whatsapp', 'cep'].includes(campo)) v = soDigitos(v) || null;
    if (v && campo === 'uf') v = v.toUpperCase();
    if (v && campo === 'email') v = v.toLowerCase();
    out[campo] = v;
  }
  if (body.propriedade_area_ha !== undefined) out.propriedade_area_ha = num(body.propriedade_area_ha);
  if (body.data_nascimento !== undefined) out.data_nascimento = dataISO(body.data_nascimento);
  return out;
}

/* Situação de credenciamento: combina status e validade */
export async function situacao(a) {
  if (a.status !== 'ativo') return a.status;
  if (!a.validade_ate) return 'regular';
  const hoje = hojeISO();
  if (a.validade_ate < hoje) return 'vencido';
  const cfg = await configuracoes();
  const aviso = Number(cfg.aviso_recredenciamento_dias) || 60;
  if (a.validade_ate <= addDias(hoje, aviso)) return 'renovar';
  return 'regular';
}

export async function serializar(a) {
  const { senha_hash: _s, observacoes: _o, ...resto } = a;
  return { ...resto, situacao: await situacao(a) };
}

export function novoCodigoValidacao() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

/* Próxima matrícula numérica livre */
export async function proximaMatricula(conn = pool) {
  const [[{ m }]] = await conn.query(
    "SELECT COALESCE(MAX(CAST(matricula AS UNSIGNED)), 0) AS m FROM associados WHERE matricula REGEXP '^[0-9]+$'"
  );
  return String(Number(m) + 1);
}

/* Grava os documentos enviados (multer .array) vinculados ao associado */
export async function salvarDocumentos(conn, associadoId, files, tipos, recredenciamentoId = null) {
  const lista = Array.isArray(tipos) ? tipos : tipos ? [tipos] : [];
  for (const [i, f] of (files || []).entries()) {
    const tipo = TIPOS_DOCUMENTO[lista[i]] ? lista[i] : 'outro';
    await conn.query(
      `INSERT INTO associado_documentos (associado_id, recredenciamento_id, tipo, arquivo, nome_original, mime, tamanho)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [associadoId, recredenciamentoId, tipo, `documentos/${f.filename}`, f.originalname?.slice(0, 255), f.mimetype, f.size]
    );
  }
}

/* Remove do disco arquivos de uma requisição que falhou */
export function descartarUploads(req) {
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [];
  if (req.file) files.push(req.file);
  for (const f of files) {
    try { fs.unlinkSync(f.path); } catch { /* ignore */ }
  }
}
