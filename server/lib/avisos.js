/* ── Textos dos avisos automáticos ─────────────────────────────────
   Cada função recebe os dados do evento e dispara pelos canais ativos.
   Todas rodam em segundo plano: chame sem await nas rotas. */
import pool from '../db.js';
import { notificar, destinoAssociado, emSegundoPlano, link } from './notificacoes.js';
import { configuracoes, addDias } from './util.js';
import { hojeISO } from './auth.js';

const br = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const primeiroNome = nome => String(nome || '').split(' ')[0];
const moeda = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const competencia = c => `${c.slice(5)}/${c.slice(0, 4)}`;

async function associado(id) {
  const [[a]] = await pool.query('SELECT * FROM associados WHERE id = ?', [id]);
  return a;
}

/* ── Associado ── */

export function avisarFiliacaoAprovada(id) {
  emSegundoPlano(async () => {
    const a = await associado(id);
    await notificar({
      evento: 'filiacao_aprovada', para: destinoAssociado(a),
      titulo: 'Sua filiação ao SIRAN foi aprovada! 🎉',
      paragrafos: [
        `Olá, ${primeiroNome(a.nome)}! Seja bem-vindo(a) ao Sindicato Rural da Alta Noroeste.`,
        `Sua matrícula é ${a.matricula} e o credenciamento vale até ${br(a.validade_ate)}.`,
        'Na Área do Associado você já pode usar a carteirinha digital, os classificados, o guia de conveniados e acompanhar os comunicados.',
      ],
      botao: link('/app') && { texto: 'Acessar a Área do Associado', url: link('/app') },
    });
  });
}

export function avisarFiliacaoRecusada(id, motivo) {
  emSegundoPlano(async () => {
    const a = await associado(id);
    await notificar({
      evento: 'filiacao_recusada', para: destinoAssociado(a), essencial: true,
      titulo: 'Pedido de filiação não aprovado',
      paragrafos: [
        `Olá, ${primeiroNome(a.nome)}. Seu pedido de filiação ao SIRAN não foi aprovado.`,
        motivo ? `Motivo: ${motivo}` : null,
        'Em caso de dúvida, fale com o sindicato.',
      ].filter(Boolean),
    });
  });
}

export function avisarRecredenciamento(id, decisao, resposta, validadeNova) {
  emSegundoPlano(async () => {
    const a = await associado(id);
    const textos = {
      aprovado: ['Recredenciamento aprovado ✅', `Olá, ${primeiroNome(a.nome)}! Seu recredenciamento foi aprovado e o credenciamento agora vale até ${br(validadeNova)}.`],
      pendencia: ['Seu recredenciamento precisa de um ajuste', `Olá, ${primeiroNome(a.nome)}. A equipe do SIRAN analisou seu recredenciamento e encontrou uma pendência.`],
      reprovado: ['Recredenciamento não aprovado', `Olá, ${primeiroNome(a.nome)}. Seu recredenciamento não foi aprovado.`],
    };
    const [titulo, abertura] = textos[decisao];
    await notificar({
      evento: `recredenciamento_${decisao}`, para: destinoAssociado(a), essencial: decisao !== 'aprovado',
      titulo,
      paragrafos: [abertura, resposta ? `Mensagem do sindicato: ${resposta}` : null].filter(Boolean),
      botao: link('/app/recredenciamento') && { texto: decisao === 'pendencia' ? 'Corrigir e reenviar' : 'Ver detalhes', url: link('/app/recredenciamento') },
    });
  });
}

export function avisarAnuncioModerado(classificadoId, decisao, motivo) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query('SELECT id, titulo, associado_id, expira_em FROM classificados WHERE id = ?', [classificadoId]);
    if (!c) return;
    const a = await associado(c.associado_id);
    const aprovado = decisao === 'aprovar';
    await notificar({
      evento: aprovado ? 'anuncio_aprovado' : 'anuncio_reprovado', para: destinoAssociado(a),
      titulo: aprovado ? 'Seu anúncio está no ar!' : 'Seu anúncio precisa de ajuste',
      paragrafos: aprovado
        ? [`"${c.titulo}" foi aprovado e já aparece para os associados nos classificados do SIRAN.`, `Ele fica publicado até ${br(c.expira_em)}.`]
        : [`"${c.titulo}" não foi publicado.`, motivo ? `Motivo: ${motivo}` : null, 'Edite o anúncio e envie novamente para aprovação.'].filter(Boolean),
      botao: link(aprovado ? `/app/classificados/${c.id}` : '/app/classificados/meus') && {
        texto: aprovado ? 'Ver anúncio' : 'Editar anúncio', url: link(aprovado ? `/app/classificados/${c.id}` : '/app/classificados/meus'),
      },
    });
  });
}

export function avisarBoletoDisponivel(boletoId) {
  emSegundoPlano(async () => {
    const [[b]] = await pool.query('SELECT * FROM boletos WHERE id = ?', [boletoId]);
    if (!b || b.status !== 'aberto') return;
    const a = await associado(b.associado_id);
    await notificar({
      evento: 'boleto_disponivel', para: destinoAssociado(a), chave: `boleto_disp:${b.id}`,
      titulo: `Boleto da mensalidade ${competencia(b.competencia)} disponível`,
      paragrafos: [
        `Olá, ${primeiroNome(a.nome)}! O boleto de ${moeda(b.valor)} com vencimento em ${br(b.vencimento)} já está na Área do Associado.`,
        'Lá você copia o código de barras ou o Pix e paga pelo app do banco.',
      ],
      botao: link('/app/boletos') && { texto: 'Ver boleto', url: link('/app/boletos') },
    });
  });
}

/* Novo comunicado: só quando a equipe marca "avisar associados".
   Vai pela fila com intervalo entre envios. */
export function avisarComunicado(comunicadoId) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query('SELECT * FROM comunicados WHERE id = ? AND publicado = 1', [comunicadoId]);
    if (!c) return;
    const [associados] = await pool.query("SELECT * FROM associados WHERE status = 'ativo'");
    for (const a of associados) {
      await notificar({
        evento: 'comunicado', para: destinoAssociado(a), chave: `comunicado:${c.id}:${a.id}`,
        titulo: `${c.origem === 'OUTROS' ? 'Novo comunicado' : `Novo comunicado ${c.origem}`}: ${c.titulo}`,
        paragrafos: [c.resumo || 'Um novo comunicado oficial foi publicado na Área do Associado.'],
        botao: link(`/app/comunicados/${c.id}`) && { texto: 'Ler comunicado', url: link(`/app/comunicados/${c.id}`) },
      });
    }
  });
}

/* ── Equipe do sindicato ── */
export function avisarEquipe(evento, titulo, paragrafos, caminho) {
  emSegundoPlano(async () => {
    const cfg = await configuracoes();
    const emails = String(cfg.notif_equipe_emails || '').split(/[,;\s]+/).filter(e => e.includes('@'));
    for (const email of emails) {
      await notificar({
        evento, para: { email }, essencial: true, titulo, paragrafos,
        botao: link(caminho) && { texto: 'Abrir no painel', url: link(caminho) },
      });
    }
  });
}

/* ── Lembretes diários ──────────────────────────────────────────
   Credenciamento: quando abre a janela de recredenciamento, 7 dias antes
   e no dia seguinte ao vencimento. Boleto: N dias antes do vencimento.
   A "chave" garante um único envio por lembrete. */
export async function enviarLembretes() {
  const cfg = await configuracoes();
  const hoje = hojeISO();
  const aviso = Number(cfg.aviso_recredenciamento_dias) || 60;
  let total = 0;

  const marcos = [
    [addDias(hoje, aviso), 'abertura', a => [`Seu credenciamento no SIRAN vence em ${br(a.validade_ate)}.`, 'O recredenciamento já está aberto: confira seus dados e envie os documentos atualizados pela Área do Associado.']],
    [addDias(hoje, 7), '7dias', a => [`Faltam 7 dias para o vencimento do seu credenciamento (${br(a.validade_ate)}).`, 'Faça o recredenciamento para não perder os benefícios.']],
    [addDias(hoje, -1), 'vencido', a => [`Seu credenciamento venceu em ${br(a.validade_ate)}.`, 'Faça o recredenciamento para voltar a ter todos os benefícios.']],
  ];
  for (const [data, tipo, texto] of marcos) {
    const [lista] = await pool.query(
      `SELECT a.* FROM associados a WHERE a.status = 'ativo' AND a.validade_ate = ?
          AND NOT EXISTS (SELECT 1 FROM recredenciamentos r WHERE r.associado_id = a.id AND r.status = 'enviado')`, [data]);
    for (const a of lista) {
      const r = await notificar({
        evento: `lembrete_credenciamento_${tipo}`, para: destinoAssociado(a), chave: `cred:${tipo}:${a.id}:${a.validade_ate}`,
        titulo: tipo === 'vencido' ? 'Credenciamento vencido' : 'Hora de fazer o recredenciamento',
        paragrafos: [`Olá, ${primeiroNome(a.nome)}!`, ...texto(a)],
        botao: link('/app/recredenciamento') && { texto: 'Recredenciar agora', url: link('/app/recredenciamento') },
      });
      if (r.email || r.whatsapp) total++;
    }
  }

  const diasBoleto = Number(cfg.lembrete_boleto_dias);
  if (diasBoleto > 0) {
    const [boletos] = await pool.query(
      `SELECT b.*, a.id AS a_id FROM boletos b JOIN associados a ON a.id = b.associado_id
        WHERE b.status = 'aberto' AND b.vencimento = ? AND a.status IN ('ativo','suspenso')`, [addDias(hoje, diasBoleto)]);
    for (const b of boletos) {
      const a = await associado(b.associado_id);
      const r = await notificar({
        evento: 'lembrete_boleto', para: destinoAssociado(a), chave: `boleto_lembrete:${b.id}`,
        titulo: `Lembrete: mensalidade vence em ${br(b.vencimento)}`,
        paragrafos: [`Olá, ${primeiroNome(a.nome)}! O boleto da mensalidade ${competencia(b.competencia)} (${moeda(b.valor)}) vence em ${br(b.vencimento)}.`, 'Se já pagou, desconsidere esta mensagem.'],
        botao: link('/app/boletos') && { texto: 'Ver boleto', url: link('/app/boletos') },
      });
      if (r.email || r.whatsapp) total++;
    }
  }
  return total;
}

/* Roda os lembretes uma vez por dia, às 9h (horário do servidor) */
export function agendarLembretes() {
  let ultimoDia = null;
  const verificar = async () => {
    const agora = new Date();
    const dia = hojeISO();
    if (agora.getHours() >= 9 && ultimoDia !== dia) {
      ultimoDia = dia;
      try {
        const n = await enviarLembretes();
        if (n) console.log(`📨 ${n} lembrete(s) enfileirado(s)`);
      } catch (err) {
        console.warn('[lembretes]', err.message);
      }
    }
  };
  setInterval(verificar, 15 * 60 * 1000);
  setTimeout(verificar, 60 * 1000);
}
