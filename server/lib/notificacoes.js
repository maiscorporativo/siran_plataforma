/* ── Envio de e-mail (SMTP) e WhatsApp (Evolution API) ─────────────
   Tudo é opcional: sem as variáveis de ambiente o canal não dispara e
   o sistema segue normalmente. Nenhum envio pode derrubar ou atrasar
   uma requisição — as mensagens entram numa fila processada em segundo
   plano e cada tentativa fica registrada em notificacoes_log. */
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pool from '../db.js';

dotenv.config({ quiet: true });

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = process.env;
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `SIRAN <${SMTP_USER}>` : '');
// Aceita os dois nomes usados nos outros sistemas
const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || process.env.EVOLUTION_URL || '').replace(/\/+$/, '');
export const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');

const emailAtivo = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const whatsappAtivo = Boolean(EVOLUTION_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);

const transporter = emailAtivo
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/* Intervalo entre mensagens de WhatsApp: envio em massa por API não
   oficial é o que mais leva a bloqueio do número. */
const INTERVALO_WHATSAPP_MS = Number(process.env.WHATSAPP_INTERVALO_MS) || 4000;
const INTERVALO_EMAIL_MS = 1200;

export function normalizarTelefone(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('55') && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

/* ── Envio direto ─────────────────────────────────────────────── */
async function enviarEmail(para, assunto, texto, html) {
  await transporter.sendMail({ from: SMTP_FROM, to: para, subject: assunto, text: texto, html });
}

/* POST {url}/message/sendText/{instancia}. A v2 espera { number, text };
   a v1 espera { number, textMessage: { text } } — tenta as duas. */
async function enviarEvolution(numero, texto) {
  const url = `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`;
  const headers = { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY };
  const tentar = corpo => fetch(url, { method: 'POST', headers, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000) });

  let res = await tentar({ number: numero, text: texto, linkPreview: false });
  if (res.status === 400 || res.status === 404) {
    const erroV2 = (await res.text()).slice(0, 200);
    res = await tentar({ number: numero, textMessage: { text: texto }, options: { linkPreview: false } });
    if (!res.ok) throw new Error(`Evolution ${res.status}: ${(await res.text()).slice(0, 200)} (v2: ${erroV2})`);
    return;
  }
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/* ── Filas (uma por canal, em memória) ────────────────────────── */
function criarFila(intervalo, enviar) {
  const itens = [];
  let rodando = false;
  async function processar() {
    if (rodando) return;
    rodando = true;
    while (itens.length) {
      const item = itens.shift();
      try {
        await enviar(item);
        await pool.query("UPDATE notificacoes_log SET status = 'enviado', enviado_em = NOW() WHERE id = ?", [item.logId]);
      } catch (err) {
        console.warn(`[notificacoes] ${item.canal} para ${item.destino} falhou:`, err.message);
        await pool.query("UPDATE notificacoes_log SET status = 'falha', erro = ? WHERE id = ?",
          [String(err.message).slice(0, 500), item.logId]).catch(() => {});
      }
      if (itens.length) await new Promise(r => setTimeout(r, intervalo));
    }
    rodando = false;
  }
  return {
    adicionar(item) { itens.push(item); setImmediate(processar); },
    get tamanho() { return itens.length; },
  };
}

const filaEmail = criarFila(INTERVALO_EMAIL_MS, i => enviarEmail(i.destino, i.assunto, i.texto, i.html));
const filaWhatsapp = criarFila(INTERVALO_WHATSAPP_MS, i => enviarEvolution(i.destino, i.texto));

/* Registra no log e enfileira. Com `chave`, o mesmo aviso nunca é enviado
   duas vezes pelo mesmo canal (ex.: lembrete de vencimento). */
async function enfileirar(canal, { associadoId = null, evento, destino, chave = null, ...conteudo }) {
  try {
    const [r] = await pool.query(
      'INSERT IGNORE INTO notificacoes_log (associado_id, evento, canal, destino, chave) VALUES (?, ?, ?, ?, ?)',
      [associadoId, evento, canal, destino, chave]);
    if (!r.affectedRows) return false; // já enviado antes
    (canal === 'email' ? filaEmail : filaWhatsapp).adicionar({ ...conteudo, canal, destino, logId: r.insertId });
    return true;
  } catch (err) {
    console.warn('[notificacoes] falha ao enfileirar:', err.message);
    return false;
  }
}

/* ── Modelo visual do e-mail ──────────────────────────────────── */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function htmlEmail({ titulo, paragrafos, botao }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#292524">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:#082a1d;color:#fff;padding:18px 24px;border-radius:14px 14px 0 0">
      <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:.5px">SIRAN</p>
      <p style="margin:2px 0 0;font-size:12px;opacity:.75">Sindicato Rural da Alta Noroeste · Área do Associado</p>
    </div>
    <div style="background:#fff;border:1px solid #e7e5e4;border-top:0;border-radius:0 0 14px 14px;padding:24px">
      <h1 style="margin:0 0 14px;font-size:19px;color:#105037">${esc(titulo)}</h1>
      ${paragrafos.map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
      ${botao ? `<a href="${esc(botao.url)}" style="display:inline-block;margin-top:8px;background:#105037;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">${esc(botao.texto)}</a>` : ''}
    </div>
    <p style="text-align:center;font-size:11px;color:#a8a29e;margin-top:14px">Mensagem automática — não responda este e-mail.</p>
  </div></body></html>`;
}

function textoWhatsapp({ titulo, paragrafos, botao }) {
  return [`*${titulo}*`, '', ...paragrafos.flatMap(p => [p, '']), botao ? `${botao.texto}: ${botao.url}` : null, '', '_SIRAN · Sindicato Rural da Alta Noroeste_']
    .filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ── API pública do módulo ────────────────────────────────────── */

export function statusCanais() {
  return {
    email: emailAtivo, whatsapp: whatsappAtivo,
    remetente: emailAtivo ? SMTP_FROM : null,
    instancia: whatsappAtivo ? EVOLUTION_INSTANCE : null,
    app_url: APP_URL || null,
    fila: { email: filaEmail.tamanho, whatsapp: filaWhatsapp.tamanho },
  };
}

/* Confere conexão com SMTP e Evolution, sem enviar nada */
export async function diagnosticar() {
  const out = { email: null, whatsapp: null };
  if (emailAtivo) {
    try { await transporter.verify(); out.email = 'ok'; } catch (e) { out.email = e.message; }
  }
  if (whatsappAtivo) {
    try {
      const r = await fetch(`${EVOLUTION_URL}/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
        { headers: { apikey: EVOLUTION_API_KEY }, signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => ({}));
      const estado = j?.instance?.state || j?.state;
      out.whatsapp = r.ok ? (estado === 'open' ? 'ok' : `instância ${estado || 'desconectada'}`) : `HTTP ${r.status}`;
    } catch (e) { out.whatsapp = e.message; }
  }
  return out;
}

/**
 * Envia uma mensagem para uma pessoa pelos canais disponíveis.
 * @param {object} p
 * @param {string} p.evento       identificador (ex.: 'filiacao_aprovada')
 * @param {object} p.para         { associadoId?, email?, whatsapp?, aceitaEmail?, aceitaWhatsapp? }
 * @param {string} p.titulo       assunto do e-mail / título no WhatsApp
 * @param {string[]} p.paragrafos texto
 * @param {object} [p.botao]      { texto, url }
 * @param {string} [p.chave]      evita envio repetido
 * @param {boolean} [p.essencial] ignora a preferência de não receber avisos (ex.: recuperação de senha)
 * @returns {Promise<{email: string|null, whatsapp: string|null}>} destinos usados
 */
export async function notificar({ evento, para, titulo, paragrafos, botao, chave = null, essencial = false }) {
  const usados = { email: null, whatsapp: null };
  const email = para.email?.trim();
  const fone = normalizarTelefone(para.whatsapp);

  if (emailAtivo && email && (essencial || para.aceitaEmail !== 0)) {
    const ok = await enfileirar('email', {
      associadoId: para.associadoId, evento, destino: email, chave,
      assunto: `${titulo} — SIRAN`, texto: textoWhatsapp({ titulo, paragrafos, botao }).replace(/[*_]/g, ''),
      html: htmlEmail({ titulo, paragrafos, botao }),
    });
    if (ok) usados.email = email;
  }
  if (whatsappAtivo && fone && (essencial || para.aceitaWhatsapp !== 0)) {
    const ok = await enfileirar('whatsapp', {
      associadoId: para.associadoId, evento, destino: fone, chave,
      texto: textoWhatsapp({ titulo, paragrafos, botao }),
    });
    if (ok) usados.whatsapp = fone;
  }
  return usados;
}

/* Atalho: monta o destinatário a partir de um registro de associado */
export function destinoAssociado(a) {
  return {
    associadoId: a.id, email: a.email, whatsapp: a.whatsapp || a.telefone,
    aceitaEmail: a.aceita_email, aceitaWhatsapp: a.aceita_whatsapp,
  };
}

/* Dispara sem bloquear a resposta HTTP e sem nunca lançar erro */
export function emSegundoPlano(fn) {
  setImmediate(() => { Promise.resolve().then(fn).catch(err => console.warn('[notificacoes]', err.message)); });
}

/* Envio de teste pelo painel */
export async function enviarTeste({ email, whatsapp }) {
  return notificar({
    evento: 'teste', para: { email, whatsapp }, essencial: true,
    titulo: 'Teste de envio',
    paragrafos: ['Esta é uma mensagem de teste da Plataforma do Associado SIRAN.', 'Se você recebeu, o canal está funcionando.'],
  });
}

export const link = caminho => (APP_URL ? `${APP_URL}${caminho}` : null);
