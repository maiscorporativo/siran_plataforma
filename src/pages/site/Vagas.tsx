import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Banknote, Briefcase, Building2, CalendarDays, CheckCircle2, Clock, GraduationCap, MapPin, Search, Send, Users } from 'lucide-react'
import SiteLayout from '../../layouts/SiteLayout'
import { api, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useCandidato } from '../../lib/auth'
import { data } from '../../lib/format'
import { AreaTexto, Aviso, Botao, BotaoLink, Cabecalho, Carregando, Cartao, Erro, Paginacao, Vazio, cx, useToast } from '../../components/ui'
import { CartaoVaga, EtiquetaTipoVaga } from '../../components/vagas'
import { NIVEL_ESTAGIO, type Paginado, type Vaga } from '../../lib/tipos'

export function VagasPublico() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const f = (k: string) => params.get(k) || ''
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Vaga> & { cidades: string[]; areas: string[] }>(
    `/vagas${qs({ q: f('q'), tipo: f('tipo'), area: f('area'), cidade: f('cidade'), pagina: f('pagina') })}`)
  const mudar = (m: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(m)) v ? p.set(k, v) : p.delete(k)
    if (!('pagina' in m)) p.delete('pagina')
    setParams(p)
  }

  return (
    <SiteLayout>
      <Cabecalho titulo="Vagas de emprego e estágio no agro"
        descricao="Oportunidades em propriedades e empresas rurais da região, divulgadas pelo SIRAN."
        acoes={<>
          <BotaoLink to="/candidato/cadastro" icone={<Send className="size-4" />}>Cadastrar currículo</BotaoLink>
          <BotaoLink to="/empresa/entrar" variante="secundario" icone={<Briefcase className="size-4" />}>Anunciar vaga</BotaoLink>
        </>} />

      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'Todas'], ['emprego', 'Emprego'], ['estagio', 'Estágio'], ['temporario', 'Temporário / safra']].map(([k, r]) => (
          <button key={r} onClick={() => mudar({ tipo: k })}
            className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', f('tipo') === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Tratorista, veterinária, agronomia…" className="campo !pl-10" aria-label="Buscar vagas" />
        </form>
        <select value={f('area')} onChange={e => mudar({ area: e.target.value })} className="campo" aria-label="Área">
          <option value="">Todas as áreas</option>
          {dados?.areas.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={f('cidade')} onChange={e => mudar({ cidade: e.target.value })} className="campo" aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {dados?.cidades.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="mt-5">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<Briefcase />} titulo="Nenhuma vaga encontrada">Cadastre seu currículo para ser avisado quando surgirem oportunidades.</Vazio>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-500">{dados.total} vaga(s)</p>
            <div className={cx('grid gap-3 md:grid-cols-2', carregando && 'opacity-60')}>
              {dados.itens.map(v => <CartaoVaga key={v.id} v={v} base="/vagas" />)}
            </div>
            <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => mudar({ pagina: String(p) })} />
          </>
        )}
      </div>
    </SiteLayout>
  )
}

export function VagaPublica() {
  const { id } = useParams()
  const { dados: v, erro, carregando, recarregar } = useApi<Vaga>(`/vagas/${id}`)
  const { usuario: candidato } = useCandidato()
  const { dados: minhas, recarregar: recarregarMinhas } = useApi<{ vaga_id: number; status: string }[]>(candidato ? '/candidato/candidaturas' : null)
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const local = useLocation()
  const toast = useToast()

  if (carregando && !v) return <SiteLayout><Carregando /></SiteLayout>
  if (erro || !v) return <SiteLayout><Cabecalho titulo="Vaga" voltar="/vagas" /><Erro mensagem={erro || ''} tentar={recarregar} /></SiteLayout>

  const jaCandidatou = minhas?.find(m => m.vaga_id === v.id && m.status !== 'desistiu')
  const estagioSemCurso = v.tipo === 'estagio' && candidato && (!candidato.estudante || !candidato.instituicao_id)

  async function candidatar() {
    setEnviando(true)
    try {
      await api(`/vagas/${v!.id}/candidatar`, { method: 'POST', body: { mensagem }, area: 'candidato' })
      toast('Candidatura enviada! Você será avisado sobre cada etapa.')
      recarregarMinhas()
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  const blocos = [['Atividades', v.descricao], ['Requisitos', v.requisitos], ['Benefícios', v.beneficios]].filter(([, t]) => t)
  const info = [
    { icone: Building2, rotulo: 'Contratante', valor: v.ofertante },
    { icone: MapPin, rotulo: 'Local de trabalho', valor: `${v.cidade}${v.uf ? `/${v.uf}` : ''}` },
    v.remuneracao && { icone: Banknote, rotulo: v.tipo === 'estagio' ? 'Bolsa' : 'Remuneração', valor: v.remuneracao },
    v.jornada && { icone: Clock, rotulo: 'Jornada', valor: v.jornada },
    v.quantidade > 1 && { icone: Users, rotulo: 'Vagas', valor: String(v.quantidade) },
    v.tipo === 'estagio' && v.estagio_nivel && { icone: GraduationCap, rotulo: 'Nível', valor: NIVEL_ESTAGIO[v.estagio_nivel] },
    v.tipo === 'estagio' && v.estagio_cursos && { icone: GraduationCap, rotulo: 'Cursos', valor: v.estagio_cursos },
    { icone: CalendarDays, rotulo: 'Publicada em', valor: data(v.publicado_em) },
  ].filter(Boolean) as { icone: typeof Building2; rotulo: string; valor: string }[]

  return (
    <SiteLayout>
      <Cabecalho titulo={v.titulo} voltar="/vagas" descricao={<span className="flex flex-wrap items-center gap-2"><EtiquetaTipoVaga tipo={v.tipo} />{v.area && <span className="text-sm">{v.area}</span>}</span>} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {blocos.map(([t, txt]) => (
            <Cartao key={t} className="p-5"><h2 className="mb-2 font-semibold">{t}</h2><p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-700">{txt}</p></Cartao>
          ))}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Cartao className="space-y-3 p-5">
            {info.map(i => (
              <div key={i.rotulo} className="flex gap-3">
                <i.icone className="mt-0.5 size-5 shrink-0 text-siran-600" />
                <div><p className="text-xs uppercase tracking-wide text-stone-500">{i.rotulo}</p><p className="font-medium text-stone-800">{i.valor}</p></div>
              </div>
            ))}
          </Cartao>
          <Cartao className="p-5">
            {jaCandidatou ? (
              <div className="space-y-3">
                <CheckCircle2 className="size-9 text-siran-600" />
                <p className="font-semibold">Você já se candidatou a esta vaga</p>
                <BotaoLink to="/candidato" variante="secundario">Acompanhar minhas candidaturas</BotaoLink>
              </div>
            ) : !candidato ? (
              <div className="space-y-3">
                <p className="font-semibold">Quer esta vaga?</p>
                <p className="text-sm text-stone-600">Crie sua conta de candidato e cadastre seu currículo — leva poucos minutos e serve para todas as vagas.</p>
                <BotaoLink to="/candidato/cadastro" className="w-full">Criar conta e me candidatar</BotaoLink>
                <p className="text-sm text-stone-500">Já tem conta? <Link to="/candidato/entrar" state={{ de: local.pathname }} className="font-medium text-siran-700 hover:underline">Entrar</Link></p>
              </div>
            ) : estagioSemCurso ? (
              <Aviso tom="amarelo" titulo="Vaga de estágio é para estudantes"
                acao={<BotaoLink to="/candidato/perfil" variante="secundario">Completar perfil</BotaoLink>}>
                Informe no seu perfil a instituição de ensino e o curso para se candidatar.
              </Aviso>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold">Candidatar-se</p>
                <AreaTexto rotulo="Mensagem para o contratante (opcional)" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3}
                  placeholder="Conte em poucas palavras por que você é a pessoa certa para a vaga." />
                <Botao onClick={candidatar} carregando={enviando} className="w-full" icone={<Send className="size-4" />}>Enviar candidatura</Botao>
                <p className="text-xs text-stone-500">O contratante vê seu currículo. Seu telefone e e-mail só aparecem se você for chamado para entrevista.</p>
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </SiteLayout>
  )
}
