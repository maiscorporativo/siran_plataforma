import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Clock, Lock, MapPin, Search, Users } from 'lucide-react'
import { qs } from '../lib/api'
import { useApi } from '../lib/useApi'
import { data } from '../lib/format'
import { Botao, Carregando, Erro, Etiqueta, Vazio, cx, type Tom } from './ui'
import type { Curso } from '../lib/tipos'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/* "25 a 27/11/2026" ou "10/11/2026" */
export function periodoCurso(c: Pick<Curso, 'data_inicio' | 'data_fim'>) {
  if (!c.data_fim || c.data_fim === c.data_inicio) return data(c.data_inicio)
  const [a1, m1, d1] = c.data_inicio.split('-')
  const [a2, m2] = c.data_fim.split('-')
  if (a1 === a2 && m1 === m2) return `${d1} a ${data(c.data_fim)}`
  return `${data(c.data_inicio)} a ${data(c.data_fim)}`
}

const SITUACAO: Record<string, [string, Tom]> = {
  aberto: ['Inscrições abertas', 'verde'],
  inscricoes_encerradas: ['Inscrições encerradas', 'cinza'],
  em_andamento: ['Em andamento', 'azul'],
  encerrado: ['Realizado', 'cinza'],
  cancelado: ['Cancelado', 'vermelho'],
}

export function SituacaoCurso({ c }: { c: Curso }) {
  if (c.situacao === 'aberto' && c.lotado) return <Etiqueta tom="amarelo">Lotado · lista de espera</Etiqueta>
  const [t, tom] = SITUACAO[c.situacao] || [c.situacao, 'cinza']
  return <Etiqueta tom={tom}>{t}</Etiqueta>
}

export function StatusInscricao({ status }: { status: string }) {
  if (status === 'confirmada') return <Etiqueta tom="verde">Inscrição confirmada</Etiqueta>
  if (status === 'espera') return <Etiqueta tom="amarelo">Lista de espera</Etiqueta>
  return <Etiqueta tom="cinza">Cancelada</Etiqueta>
}

export function CartaoCurso({ c, base }: { c: Curso; base: string }) {
  const [, m, d] = c.data_inicio.split('-')
  const minha = typeof c.minha_inscricao === 'string' ? c.minha_inscricao : c.minha_inscricao?.status
  return (
    <Link to={`${base}/${c.id}`} className="group flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-siran-600 hover:shadow-sm">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-siran-900 py-2 text-white">
        <span className="text-2xl font-semibold leading-none">{d}</span>
        <span className="text-xs uppercase tracking-wide text-siran-100">{MESES[Number(m) - 1]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SituacaoCurso c={c} />
          {c.tipo === 'evento' && <Etiqueta tom="azul">Evento</Etiqueta>}
          {c.publico === 'associados' && <Etiqueta><Lock className="size-3" /> Exclusivo associados</Etiqueta>}
          {minha && <StatusInscricao status={minha} />}
        </div>
        <p className="mt-1.5 font-semibold leading-snug text-stone-900 group-hover:text-siran-800">{c.titulo}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {periodoCurso(c)}</span>
          {c.cidade && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {c.cidade}</span>}
          {c.carga_horaria && <span className="flex items-center gap-1"><Clock className="size-3.5" /> {c.carga_horaria}h</span>}
          {c.vagas_restantes !== null && c.situacao === 'aberto' && !c.lotado && (
            <span className="flex items-center gap-1"><Users className="size-3.5" /> {c.vagas_restantes} vaga(s)</span>
          )}
        </div>
      </div>
    </Link>
  )
}

/* Agenda com busca e filtros — usada no site público e na Área do Associado */
export function AgendaCursos({ base }: { base: string }) {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const f = (k: string) => params.get(k) || ''
  const { dados, erro, carregando, recarregar } = useApi<{ itens: Curso[]; cidades: string[]; categorias: string[] }>(
    `/cursos${qs({ q: f('q'), tipo: f('tipo'), cidade: f('cidade'), categoria: f('categoria'), anteriores: f('anteriores') })}`)
  const mudar = (m: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(m)) v ? p.set(k, v) : p.delete(k)
    setParams(p)
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar curso, evento ou tema" className="campo !pl-10" aria-label="Buscar" />
        </div>
        <Botao type="submit">Buscar</Botao>
      </form>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <select value={f('tipo')} onChange={e => mudar({ tipo: e.target.value })} className="campo" aria-label="Tipo">
          <option value="">Cursos e eventos</option>
          <option value="curso">Só cursos</option>
          <option value="evento">Só eventos</option>
        </select>
        <select value={f('cidade')} onChange={e => mudar({ cidade: e.target.value })} className="campo" aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {dados?.cidades.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={f('categoria')} onChange={e => mudar({ categoria: e.target.value })} className="campo" aria-label="Tema">
          <option value="">Todos os temas</option>
          {dados?.categorias.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        {[['', 'Próximos'], ['1', 'Já realizados']].map(([v, r]) => (
          <button key={r} onClick={() => mudar({ anteriores: v })}
            className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', f('anteriores') === v ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      <div className="mt-5">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<CalendarDays />} titulo="Nenhum curso ou evento encontrado">Novas turmas são divulgadas aqui assim que abrem.</Vazio>
        ) : (
          <div className={cx('grid gap-3 lg:grid-cols-2', carregando && 'opacity-60')}>
            {dados.itens.map(c => <CartaoCurso key={c.id} c={c} base={base} />)}
          </div>
        )}
      </div>
    </div>
  )
}
