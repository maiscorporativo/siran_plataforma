import { Link } from 'react-router-dom'
import { Banknote, Building2, Clock, GraduationCap, MapPin } from 'lucide-react'
import { tempoRelativo } from '../lib/format'
import { Etiqueta, type Tom } from './ui'
import { STATUS_CANDIDATURA, TIPO_VAGA, type Vaga } from '../lib/tipos'

const TOM_TIPO: Record<string, Tom> = { emprego: 'verde', estagio: 'azul', temporario: 'amarelo' }

export function EtiquetaTipoVaga({ tipo }: { tipo: string }) {
  return <Etiqueta tom={TOM_TIPO[tipo] || 'cinza'}>{tipo === 'estagio' && <GraduationCap className="size-3" />}{TIPO_VAGA[tipo] || tipo}</Etiqueta>
}

const STATUS_VAGA: Record<string, [string, Tom]> = {
  pendente: ['Aguardando aprovação', 'amarelo'], aprovada: ['Publicada', 'verde'], reprovada: ['Precisa de ajuste', 'vermelho'],
  pausada: ['Pausada', 'cinza'], encerrada: ['Encerrada', 'cinza'], expirada: ['Expirada', 'cinza'],
}
export function StatusVaga({ status }: { status: string }) {
  const [t, tom] = STATUS_VAGA[status] || [status, 'cinza']
  return <Etiqueta tom={tom}>{t}</Etiqueta>
}

const TOM_CANDIDATURA: Record<string, Tom> = {
  enviada: 'cinza', em_analise: 'azul', entrevista: 'amarelo', aprovada: 'verde', nao_selecionada: 'vermelho', desistiu: 'cinza',
}
export function StatusCandidatura({ status }: { status: string }) {
  return <Etiqueta tom={TOM_CANDIDATURA[status] || 'cinza'}>{STATUS_CANDIDATURA[status] || status}</Etiqueta>
}

export function CartaoVaga({ v, base }: { v: Vaga; base: string }) {
  return (
    <Link to={`${base}/${v.id}`} className="group block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-siran-600 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <EtiquetaTipoVaga tipo={v.tipo} />
        {v.area && <span className="text-xs text-stone-500">{v.area}</span>}
        {v.quantidade > 1 && <span className="text-xs text-stone-500">· {v.quantidade} vagas</span>}
      </div>
      <p className="mt-2 text-lg font-semibold leading-snug text-stone-900 group-hover:text-siran-800">{v.titulo}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600"><Building2 className="size-4" /> {v.ofertante}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
        <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {v.cidade}{v.uf ? `/${v.uf}` : ''}</span>
        {v.remuneracao && <span className="flex items-center gap-1"><Banknote className="size-3.5" /> {v.remuneracao}</span>}
        <span className="flex items-center gap-1"><Clock className="size-3.5" /> {tempoRelativo(v.publicado_em)}</span>
      </div>
    </Link>
  )
}
