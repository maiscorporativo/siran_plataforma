/* Gestão de vagas de quem publica: associado (/app/vagas) ou empresa parceira (/empresa) */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Briefcase, CheckCircle2, FileText, GraduationCap, MessageCircle, Pause, Pencil, Play, Plus, RotateCcw, Send, Trash2, Users, XCircle } from 'lucide-react'
import { abrirArquivo, api, type Area } from '../lib/api'

import { data, idade, linkWhatsapp, mascaraTelefone } from '../lib/format'
import { AreaTexto, Aviso, Botao, BotaoLink, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Marcador, Selecao, Vazio, useConfirmacao, useToast } from './ui'
import { EtiquetaTipoVaga, StatusCandidatura, StatusVaga } from './vagas'
import { ESCOLARIDADE, type Candidatura, type Vaga } from '../lib/tipos'

type Props = { area: Area; base: string }

export function MinhasVagas({ area, base }: Props) {
  // Busca manual: a área (associado/empresa) define qual sessão é usada
  const [lista, setLista] = useState<{ itens: Vaga[] } | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function carregar() {
    try { setLista(await api('/ofertante/vagas', { area })); setFalha(null) } catch (e) { setFalha((e as Error).message) }
  }
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function acao(v: Vaga, nome: string, msg: string) {
    try { await api(`/ofertante/vagas/${v.id}/acao`, { method: 'POST', body: { acao: nome }, area }); toast(msg); carregar() } catch (e) { toast((e as Error).message, 'erro') }
  }
  async function excluir(v: Vaga) {
    if (!(await confirmar('Excluir vaga', `Excluir "${v.titulo}"?`, 'Excluir', true))) return
    try { await api(`/ofertante/vagas/${v.id}`, { method: 'DELETE', area }); carregar() } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <div>
      <Cabecalho titulo="Minhas vagas" descricao="Vagas de emprego e estágio que você anunciou. Toda vaga nova ou editada passa pela aprovação do SIRAN."
        acoes={<BotaoLink to={`${base}/nova`} icone={<Plus className="size-4" />}>Anunciar vaga</BotaoLink>} />
      {falha ? <Erro mensagem={falha} tentar={carregar} /> : !lista ? <Carregando /> : !lista.itens.length ? (
        <Vazio icone={<Briefcase />} titulo="Você ainda não anunciou vagas">Anuncie vagas de emprego, safra ou estágio para os profissionais da região.</Vazio>
      ) : (
        <div className="space-y-3">
          {lista.itens.map(v => (
            <Cartao key={v.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><StatusVaga status={v.status_exibido || v.status} /><EtiquetaTipoVaga tipo={v.tipo} /></div>
                <Link to={`${base}/${v.id}`} className="mt-1 block font-medium text-stone-900 hover:underline">{v.titulo}</Link>
                <p className="text-sm text-stone-500">{v.cidade} · {v.status_exibido === 'aprovada' ? `publicada até ${data(v.expira_em)}` : `atualizada em ${data(v.updated_at)}`}</p>
                {v.status === 'reprovada' && v.motivo_reprovacao && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Ajuste necessário: {v.motivo_reprovacao}</p>}
              </div>
              <Link to={`${base}/${v.id}`} className="flex items-center gap-2 rounded-xl bg-siran-50 px-4 py-2 text-siran-900 hover:bg-siran-100">
                <Users className="size-5" /><span className="text-xl font-semibold">{v.candidaturas}</span><span className="text-sm">candidato(s)</span>
              </Link>
              <div className="flex flex-wrap gap-2 sm:w-40 sm:flex-col">
                {v.status !== 'encerrada' && <BotaoLink to={`${base}/${v.id}/editar`} variante="secundario" icone={<Pencil className="size-4" />}>Editar</BotaoLink>}
                {v.status_exibido === 'aprovada' && <Botao variante="secundario" tamanho="sm" icone={<Pause className="size-4" />} onClick={() => acao(v, 'pausar', 'Vaga pausada.')}>Pausar</Botao>}
                {v.status === 'pausada' && <Botao variante="claro" tamanho="sm" icone={<Play className="size-4" />} onClick={() => acao(v, 'reativar', 'Vaga reativada.')}>Reativar</Botao>}
                {v.status_exibido === 'expirada' && <Botao variante="claro" tamanho="sm" icone={<RotateCcw className="size-4" />} onClick={() => acao(v, 'renovar', 'Vaga renovada.')}>Renovar</Botao>}
                {['aprovada', 'pausada'].includes(v.status) && <Botao variante="secundario" tamanho="sm" icone={<CheckCircle2 className="size-4" />} onClick={() => acao(v, 'encerrar', 'Vaga encerrada.')}>Encerrar</Botao>}
                {!v.candidaturas && <Botao variante="fantasma" tamanho="sm" className="!text-red-700" icone={<Trash2 className="size-4" />} onClick={() => excluir(v)}>Excluir</Botao>}
              </div>
            </Cartao>
          ))}
        </div>
      )}
      {elemento}
    </div>
  )
}

export function FormVaga({ area, base }: Props) {
  const { id } = useParams()
  const navegar = useNavigate()
  const [areas, setAreas] = useState<string[]>([])
  const [d, setD] = useState<Record<string, string>>({ tipo: 'emprego', area: 'Outros', quantidade: '1', uf: 'SP', estagio_nivel: 'superior' })
  const [exibirNome, setExibirNome] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  useEffect(() => {
    if (id) {
      api<Vaga & { areas: string[] }>(`/ofertante/vagas/${id}`, { area }).then(v => {
        setAreas(v.areas)
        setD(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null || x === undefined ? '' : String(x)])))
        setExibirNome(!!v.exibir_nome)
      }).catch(e => setErro(e.message))
    } else {
      api<{ areas: string[]; ofertante: { cidade: string | null } }>('/ofertante/vagas', { area })
        .then(r => { setAreas(r.areas); if (r.ofertante.cidade) set('cidade', r.ofertante.cidade) }).catch(e => setErro(e.message))
    }
  }, [id, area])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const body = { ...d, exibir_nome: exibirNome }
      if (id) await api(`/ofertante/vagas/${id}`, { method: 'PUT', body, area })
      else await api('/ofertante/vagas', { method: 'POST', body, area })
      navegar(base, { replace: true })
    } catch (err) {
      setErro((err as Error).message)
      setEnviando(false)
    }
  }

  const estagio = d.tipo === 'estagio'
  return (
    <div className="max-w-3xl">
      <Cabecalho titulo={id ? 'Editar vaga' : 'Anunciar vaga'} voltar={base} descricao="A vaga é revisada pela equipe do SIRAN antes de aparecer para os candidatos." />
      <form onSubmit={salvar} className="space-y-6">
        <Cartao className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Tipo de vaga" value={d.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="emprego">Emprego (CLT)</option>
              <option value="temporario">Temporário / safra</option>
              <option value="estagio">Estágio</option>
            </Selecao>
            <Selecao rotulo="Área" value={d.area} onChange={e => set('area', e.target.value)}>{areas.map(a => <option key={a}>{a}</option>)}</Selecao>
          </div>
          <Entrada rotulo="Título da vaga" value={d.titulo || ''} onChange={e => set('titulo', e.target.value)} required placeholder={estagio ? 'Ex.: Estágio em zootecnia' : 'Ex.: Tratorista, retireiro, capataz'} />
          <AreaTexto rotulo="Atividades" value={d.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={5} required placeholder="O que a pessoa vai fazer no dia a dia." />
          <AreaTexto rotulo="Requisitos" value={d.requisitos || ''} onChange={e => set('requisitos', e.target.value)} rows={3} placeholder="Experiência, CNH, cursos, disponibilidade para morar na fazenda…" />
          {estagio && (
            <div className="grid gap-4 rounded-xl bg-sky-50 p-4 sm:grid-cols-2">
              <Selecao rotulo="Nível do estágio" value={d.estagio_nivel} onChange={e => set('estagio_nivel', e.target.value)}>
                <option value="superior">Ensino superior</option>
                <option value="medio_tecnico">Ensino médio / técnico</option>
                <option value="ambos">Médio, técnico ou superior</option>
              </Selecao>
              <Entrada rotulo="Cursos aceitos" value={d.estagio_cursos || ''} onChange={e => set('estagio_cursos', e.target.value)} placeholder="Agronomia, Zootecnia, Técnico agrícola…" />
              <p className="text-xs text-sky-900 sm:col-span-2">Lembrete: estágio exige termo de compromisso assinado com o estudante e a instituição de ensino, seguro contra acidentes e supervisor na propriedade (Lei 11.788/2008). Esses documentos são feitos fora da plataforma.</p>
            </div>
          )}
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo={estagio ? 'Bolsa e auxílios' : 'Remuneração'} value={d.remuneracao || ''} onChange={e => set('remuneracao', e.target.value)} placeholder={estagio ? 'Bolsa R$ 1.200 + transporte' : 'R$ 2.500 + moradia'} />
            <Entrada rotulo="Jornada" value={d.jornada || ''} onChange={e => set('jornada', e.target.value)} placeholder={estagio ? '6h por dia, seg a sex' : 'Seg a sáb, 7h às 16h'} />
            <AreaTexto rotulo="Benefícios" className="sm:col-span-2" value={d.beneficios || ''} onChange={e => set('beneficios', e.target.value)} rows={2} placeholder="Moradia, alimentação, transporte, cesta básica…" />
            <Entrada rotulo="Cidade de trabalho" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} required />
            <Entrada rotulo="Quantidade de vagas" inputMode="numeric" value={d.quantidade} onChange={e => set('quantidade', e.target.value.replace(/\D/g, ''))} />
          </div>
          <Marcador checked={exibirNome} onChange={setExibirNome} rotulo="Mostrar meu nome no anúncio"
            descricao="Desmarcado, a vaga aparece como “Produtor rural associado ao SIRAN” ou “Empresa parceira do SIRAN”." />
        </Cartao>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" tamanho="lg" carregando={enviando} icone={<Send className="size-4" />}>{id ? 'Salvar e enviar para aprovação' : 'Enviar para aprovação'}</Botao>
      </form>
    </div>
  )
}

export function CandidaturasVaga({ area, base }: Props) {
  const { id } = useParams()
  const [dados, setDados] = useState<{ vaga: Vaga; candidaturas: Candidatura[] } | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const toast = useToast()

  async function carregar() {
    try { setDados(await api(`/ofertante/vagas/${id}/candidaturas`, { area })) } catch (e) { setFalha((e as Error).message) }
  }
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function mudar(c: Candidatura, status: string) {
    try { await api(`/ofertante/candidaturas/${c.id}/status`, { method: 'POST', body: { status }, area }); toast('Candidato avisado.'); carregar() } catch (e) { toast((e as Error).message, 'erro') }
  }

  if (falha) return <><Cabecalho titulo="Candidaturas" voltar={base} /><Erro mensagem={falha} /></>
  if (!dados) return <Carregando />
  const { vaga, candidaturas } = dados

  return (
    <div>
      <Cabecalho titulo={vaga.titulo} voltar={base} descricao={`${candidaturas.length} candidatura(s)`}
        acoes={<BotaoLink to={`${base}/${vaga.id}/editar`} variante="secundario" icone={<Pencil className="size-4" />}>Editar vaga</BotaoLink>} />
      {!candidaturas.length ? <Vazio icone={<Users />} titulo="Nenhuma candidatura ainda">Você recebe um aviso a cada nova candidatura.</Vazio> : (
        <div className="space-y-4">
          {candidaturas.map(c => {
            const whats = linkWhatsapp(c.whatsapp, `Olá, ${c.nome.split(' ')[0]}! Sobre sua candidatura à vaga "${vaga.titulo}" no SIRAN:`)
            return (
              <Cartao key={c.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-stone-900">{c.nome}</p>
                    <p className="text-sm text-stone-500">{[c.cidade, c.data_nascimento && `${idade(c.data_nascimento)} anos`, c.escolaridade && ESCOLARIDADE[c.escolaridade], c.cnh && `CNH ${c.cnh}`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <StatusCandidatura status={c.status} />
                </div>
                {c.estudante === 1 && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
                    <GraduationCap className="size-4 text-sky-700" /> {c.curso}{c.periodo ? ` · ${c.periodo}` : ''} — {c.instituicao}
                    {c.vinculo_status === 'confirmado' ? <Etiqueta tom="verde"><CheckCircle2 className="size-3" /> Matrícula confirmada</Etiqueta> : <Etiqueta>Matrícula não confirmada</Etiqueta>}
                  </p>
                )}
                {c.mensagem && <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm italic text-stone-700">“{c.mensagem}”</p>}
                {c.resumo && <p className="whitespace-pre-line text-sm text-stone-700">{c.resumo}</p>}
                {c.experiencias && <details className="text-sm"><summary className="cursor-pointer font-medium text-siran-700">Experiências</summary><p className="mt-2 whitespace-pre-line text-stone-700">{c.experiencias}</p></details>}
                <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                  {!!c.tem_curriculo && <Botao variante="secundario" tamanho="sm" icone={<FileText className="size-4" />}
                    onClick={() => abrirArquivo(`/ofertante/candidaturas/${c.id}/curriculo`).catch(e => toast(e.message, 'erro'))}>Currículo (PDF)</Botao>}
                  {c.status === 'enviada' && <Botao variante="secundario" tamanho="sm" onClick={() => mudar(c, 'em_analise')}>Marcar em análise</Botao>}
                  {['enviada', 'em_analise'].includes(c.status) && <Botao tamanho="sm" icone={<MessageCircle className="size-4" />} onClick={() => mudar(c, 'entrevista')}>Chamar para entrevista</Botao>}
                  {c.status === 'entrevista' && <Botao tamanho="sm" icone={<CheckCircle2 className="size-4" />} onClick={() => mudar(c, 'aprovada')}>Selecionar</Botao>}
                  {!['aprovada', 'nao_selecionada'].includes(c.status) && <Botao variante="fantasma" tamanho="sm" className="!text-red-700" icone={<XCircle className="size-4" />} onClick={() => mudar(c, 'nao_selecionada')}>Não selecionar</Botao>}
                  {(c.whatsapp || c.email) && (
                    <span className="ml-auto flex flex-wrap items-center gap-3 text-sm">
                      {whats && <a href={whats} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#1f9d55] hover:underline"><MessageCircle className="size-4" /> {mascaraTelefone(c.whatsapp!)}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="text-siran-700 hover:underline">{c.email}</a>}
                    </span>
                  )}
                </div>
                {!c.whatsapp && !c.email && ['enviada', 'em_analise'].includes(c.status) && <p className="text-xs text-stone-500">O contato do candidato aparece quando você o chama para entrevista.</p>}
              </Cartao>
            )
          })}
        </div>
      )}
    </div>
  )
}
