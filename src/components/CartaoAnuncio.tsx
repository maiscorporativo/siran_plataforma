import { Link } from 'react-router-dom'
import { ImageOff, MapPin } from 'lucide-react'
import { preco } from '../lib/format'
import { TIPO_ANUNCIO, type Classificado } from '../lib/tipos'

export function CartaoAnuncio({ c }: { c: Pick<Classificado, 'id' | 'titulo' | 'tipo' | 'preco' | 'preco_tipo' | 'cidade' | 'uf' | 'capa' | 'categoria' | 'condicao' | 'ano'> }) {
  return (
    <Link to={`/app/classificados/${c.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-siran-600 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-stone-100">
        {c.capa
          ? <img src={c.capa} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
          : <div className="flex size-full items-center justify-center text-stone-300"><ImageOff className="size-10" /></div>}
        {c.tipo !== 'venda' && (
          <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-xs font-semibold text-siran-900">{TIPO_ANUNCIO[c.tipo]}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-stone-900">{c.titulo}</p>
        <p className="mt-1 text-lg font-semibold text-siran-900">{preco(c)}</p>
        <div className="mt-auto flex items-center gap-1 pt-2 text-xs text-stone-500">
          <MapPin className="size-3.5" /> {c.cidade}{c.uf ? `/${c.uf}` : ''}
          {c.condicao === 'usado' && c.ano ? <span className="ml-auto">{c.ano}</span> : c.condicao === 'novo' ? <span className="ml-auto">Novo</span> : null}
        </div>
      </div>
    </Link>
  )
}
