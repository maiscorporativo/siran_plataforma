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

  // Cursos e eventos que começam amanhã: lembrete aos inscritos confirmados
  const [inscritos] = await pool.query(
    `SELECT i.*, c.titulo, c.data_inicio, c.horario, c.local, c.cidade AS curso_cidade, c.tipo
       FROM inscricoes i JOIN cursos c ON c.id = i.curso_id
      WHERE i.status = 'confirmada' AND c.status = 'publicado' AND c.data_inicio = ?`, [addDias(hoje, 1)]);
  for (const i of inscritos) {
    const r = await notificar({
      evento: 'lembrete_curso', para: await destinoInscrito(i), chave: `curso_vespera:${i.id}`,
      titulo: `Amanhã: ${i.titulo}`,
      paragrafos: [
        `Olá, ${primeiroNome(i.nome)}! Lembrete: ${i.tipo === 'evento' ? 'o evento' : 'o curso'} "${i.titulo}" começa amanhã, ${br(i.data_inicio)}${i.horario ? `, ${i.horario}` : ''}.`,
        [i.local, i.curso_cidade].filter(Boolean).join(' – ') || null,
        'Se não puder comparecer, cancele sua inscrição para liberar a vaga para outra pessoa.',
      ].filter(Boolean),
      botao: link(`/inscricao/${i.codigo}`) && { texto: 'Ver minha inscrição', url: link(`/inscricao/${i.codigo}`) },
    });
    if (r.email || r.whatsapp) total++;
  }
  return total;
}

/* ═══════════════ Cursos e eventos ═══════════════ */

/* Destinatário de uma inscrição: associado (respeita preferências) ou público */
async function destinoInscrito(i) {
  if (i.associado_id) {
    const a = await associado(i.associado_id);
    if (a) return destinoAssociado(a);
  }
  return { email: i.email, whatsapp: i.telefone };
}

export function avisarInscricao(inscricaoId, evento) {
  emSegundoPlano(async () => {
    const [[i]] = await pool.query(
      `SELECT i.*, c.titulo, c.tipo, c.data_inicio, c.horario, c.local, c.cidade AS curso_cidade
         FROM inscricoes i JOIN cursos c ON c.id = i.curso_id WHERE i.id = ?`, [inscricaoId]);
    if (!i) return;
    const oQue = i.tipo === 'evento' ? 'evento' : 'curso';
    const quando = `${br(i.data_inicio)}${i.horario ? `, ${i.horario}` : ''}`;
    const onde = [i.local, i.curso_cidade].filter(Boolean).join(' – ');
    const textos = {
      confirmada: [`Inscrição confirmada: ${i.titulo}`, [`Olá, ${primeiroNome(i.nome)}! Sua inscrição no ${oQue} "${i.titulo}" está confirmada.`, `Data: ${quando}.`, onde ? `Local: ${onde}.` : null]],
      espera: [`Lista de espera: ${i.titulo}`, [`Olá, ${primeiroNome(i.nome)}! As vagas do ${oQue} "${i.titulo}" estão preenchidas e você entrou na lista de espera.`, 'Se alguém desistir, avisamos na hora e sua inscrição é confirmada automaticamente.']],
      promovida: [`Sua vaga foi confirmada: ${i.titulo}`, [`Boa notícia, ${primeiroNome(i.nome)}! Abriu uma vaga e sua inscrição no ${oQue} "${i.titulo}" foi confirmada.`, `Data: ${quando}.`, onde ? `Local: ${onde}.` : null]],
      curso_cancelado: [`Cancelado: ${i.titulo}`, [`Olá, ${primeiroNome(i.nome)}. Infelizmente o ${oQue} "${i.titulo}" foi cancelado pelo sindicato.`, 'Fique de olho na agenda: novas turmas são divulgadas na Área do Associado e no site do SIRAN.']],
    };
    const [titulo, paragrafos] = textos[evento];
    await notificar({
      evento: `inscricao_${evento}`, para: await destinoInscrito(i), essencial: true,
      chave: `inscricao:${evento}:${i.id}`,
      titulo, paragrafos: paragrafos.filter(Boolean),
      botao: evento !== 'curso_cancelado' && link(`/inscricao/${i.codigo}`) && { texto: 'Ver minha inscrição', url: link(`/inscricao/${i.codigo}`) },
    });
  });
}

/* ═══════════════ Vagas de emprego e estágio ═══════════════ */

const destinoOrganizacao = o => ({ email: o.email, whatsapp: o.whatsapp || o.telefone });
const destinoCandidato = c => ({ email: c.email, whatsapp: c.whatsapp, aceitaEmail: c.aceita_email, aceitaWhatsapp: c.aceita_whatsapp });

/* Quem publicou a vaga: associado ou empresa parceira */
async function ofertanteDaVaga(v) {
  if (v.associado_id) {
    const a = await associado(v.associado_id);
    return { nome: a.nome, para: destinoAssociado(a), painel: '/app/vagas' };
  }
  const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [v.organizacao_id]);
  return { nome: o.responsavel || o.nome, para: destinoOrganizacao(o), painel: '/empresa' };
}

export function avisarVagaModerada(vagaId, decisao, motivo) {
  emSegundoPlano(async () => {
    const [[v]] = await pool.query('SELECT * FROM vagas WHERE id = ?', [vagaId]);
    if (!v) return;
    const of = await ofertanteDaVaga(v);
    const aprovada = decisao === 'aprovar';
    await notificar({
      evento: aprovada ? 'vaga_aprovada' : 'vaga_reprovada', para: of.para, essencial: !aprovada,
      titulo: aprovada ? 'Sua vaga foi publicada' : 'Sua vaga precisa de ajuste',
      paragrafos: aprovada
        ? [`A vaga "${v.titulo}" foi aprovada pelo SIRAN e já está visível para os candidatos.`, `Ela fica publicada até ${br(v.expira_em)}. Você recebe um aviso a cada nova candidatura.`]
        : [`A vaga "${v.titulo}" não foi publicada.`, motivo ? `Motivo: ${motivo}` : null, 'Edite a vaga e envie novamente para aprovação.'].filter(Boolean),
      botao: link(of.painel) && { texto: 'Ver minhas vagas', url: link(of.painel) },
    });
  });
}

export function avisarNovaCandidatura(candidaturaId) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query(
      `SELECT ca.id, v.*, k.nome AS candidato, k.cidade AS candidato_cidade
         FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id JOIN candidatos k ON k.id = ca.candidato_id WHERE ca.id = ?`, [candidaturaId]);
    if (!c) return;
    const of = await ofertanteDaVaga(c);
    await notificar({
      evento: 'nova_candidatura', para: of.para, chave: `candidatura_nova:${candidaturaId}`,
      titulo: `Nova candidatura: ${c.titulo}`,
      paragrafos: [`${c.candidato}${c.candidato_cidade ? ` (${c.candidato_cidade})` : ''} se candidatou à vaga "${c.titulo}".`, 'Veja o currículo e responda pela plataforma.'],
      botao: link(of.painel) && { texto: 'Ver candidaturas', url: link(of.painel) },
    });
  });
}

const STATUS_CANDIDATURA = {
  em_analise: ['Sua candidatura está em análise', 'O contratante está analisando seu currículo.'],
  entrevista: ['Você foi chamado para entrevista!', 'O contratante quer conversar com você. Fique atento ao telefone e ao WhatsApp cadastrados.'],
  aprovada: ['Parabéns, você foi selecionado!', 'O contratante selecionou você para a vaga e vai entrar em contato para os próximos passos.'],
  nao_selecionada: ['Retorno sobre sua candidatura', 'Desta vez você não foi selecionado. Continue se candidatando: novas vagas são publicadas toda semana.'],
};

export function avisarCandidaturaStatus(candidaturaId) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query(
      `SELECT ca.status, v.titulo, k.* FROM candidaturas ca JOIN vagas v ON v.id = ca.vaga_id
         JOIN candidatos k ON k.id = ca.candidato_id WHERE ca.id = ?`, [candidaturaId]);
    if (!c || !STATUS_CANDIDATURA[c.status]) return;
    const [titulo, texto] = STATUS_CANDIDATURA[c.status];
    await notificar({
      evento: `candidatura_${c.status}`, para: destinoCandidato(c), chave: `candidatura:${c.status}:${candidaturaId}`,
      titulo, paragrafos: [`Olá, ${primeiroNome(c.nome)}! Vaga: "${c.titulo}".`, texto],
      botao: link('/candidato') && { texto: 'Ver minhas candidaturas', url: link('/candidato') },
    });
  });
}

/* Estudante informou a instituição: a instituição é avisada para confirmar a matrícula */
export function avisarInstituicaoVinculo(candidatoId) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query(
      `SELECT k.nome, k.curso, k.matricula, o.* FROM candidatos k JOIN organizacoes o ON o.id = k.instituicao_id
        WHERE k.id = ? AND o.status = 'ativa'`, [candidatoId]);
    if (!c) return;
    await notificar({
      evento: 'vinculo_pendente', para: { email: c.email }, essencial: true,
      titulo: 'Estudante aguardando confirmação de matrícula',
      paragrafos: [`${c.nome} informou que estuda ${c.curso || 'na sua instituição'}${c.matricula ? ` (matrícula ${c.matricula})` : ''} e se cadastrou na plataforma de vagas do SIRAN.`, 'Confirme o vínculo para que o currículo dele apareça com o selo de matrícula confirmada nas vagas de estágio.'],
      botao: link('/instituicao') && { texto: 'Confirmar matrícula', url: link('/instituicao') },
    });
  });
}

export function avisarVinculoDecidido(candidatoId) {
  emSegundoPlano(async () => {
    const [[c]] = await pool.query(
      'SELECT k.*, o.nome AS instituicao FROM candidatos k LEFT JOIN organizacoes o ON o.id = k.instituicao_id WHERE k.id = ?', [candidatoId]);
    if (!c || !['confirmado', 'recusado'].includes(c.vinculo_status)) return;
    const ok = c.vinculo_status === 'confirmado';
    await notificar({
      evento: `vinculo_${c.vinculo_status}`, para: destinoCandidato(c), essencial: true,
      titulo: ok ? 'Matrícula confirmada pela instituição' : 'Matrícula não confirmada',
      paragrafos: ok
        ? [`${c.instituicao} confirmou sua matrícula. Seu currículo agora aparece com o selo de estudante verificado nas vagas de estágio.`]
        : [`${c.instituicao} não confirmou a matrícula informada. Confira curso e número de matrícula no seu perfil ou procure a secretaria da instituição.`],
      botao: link('/candidato/perfil') && { texto: 'Ver meu perfil', url: link('/candidato/perfil') },
    });
  });
}

export function avisarEmpresaDecidida(organizacaoId) {
  emSegundoPlano(async () => {
    const [[o]] = await pool.query('SELECT * FROM organizacoes WHERE id = ?', [organizacaoId]);
    if (!o || !['ativa', 'recusada'].includes(o.status)) return;
    const ok = o.status === 'ativa';
    await notificar({
      evento: ok ? 'empresa_aprovada' : 'empresa_recusada', para: destinoOrganizacao(o), essencial: true,
      titulo: ok ? 'Cadastro aprovado pelo SIRAN' : 'Cadastro não aprovado',
      paragrafos: ok
        ? [`Olá, ${primeiroNome(o.responsavel || o.nome)}! O cadastro de ${o.nome} foi aprovado.`, 'Você já pode publicar vagas de emprego e estágio na plataforma do SIRAN.']
        : [`O cadastro de ${o.nome} não foi aprovado.`, o.motivo_status ? `Motivo: ${o.motivo_status}` : null, 'Em caso de dúvida, fale com o sindicato.'].filter(Boolean),
      botao: ok && link('/empresa') && { texto: 'Publicar uma vaga', url: link('/empresa') },
    });
  });
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
