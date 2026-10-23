import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Megaphone, Paperclip, Search } from 'lucide-react'
import { qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data } from '../../lib/format'
import { Botao, Cabecalho, Carregando, Cartao, Erro, Paginacao, Vazio, cx } from '../../components/ui'
import { SeloOrigem } from '../../components/Status'
import { TIPO_COMUNICADO, type Comunicado, type Paginado } from '../../lib/tipos'

const ORIGENS = ['', 'FAESP', 'SENAR', 'CNA', 'SIRAN']

export default function Comunicados() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const f = (k: string) => params.get(k) || ''
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Comunicado> & { anos: number[] }>(
    `/comunicados${qs({ q: f('q'), origem: f('origem'), tipo: f('tipo'), ano: f('ano'), nao_lidos: f('nao_lidos'), pagina: f('pagina') })}`)

  const mudar = (m: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(m)) v ? p.set(k, v) : p.delete(k)
    if (!('pagina' in m)) p.delete('pagina')
    setParams(p)
  }

  return (
    <div className="max-w-4xl">
      <Cabecalho titulo="Ofícios e comunicados" descricao="Comunicações oficiais da FAESP, do SENAR, da CNA e do SIRAN." />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ORIGENS.map(o => (
          <button key={o || 'todas'} onClick={() => mudar({ origem: o })}
            className={cx('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium', f('origem') === o ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>
            {o || 'Todas'}
          </button>
        ))}
        <button onClick={() => mudar({ nao_lidos: f('nao_lidos') ? '' : '1' })}
          className={cx('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium', f('nao_lidos') ? 'border-sol-400 bg-sol-400 text-siran-950' : 'border-stone-300 bg-white text-stone-700')}>
          Não lidos
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por assunto ou número" className="campo !pl-10" aria-label="Buscar" />
          </div>
          <Botao type="submit" variante="secundario">Buscar</Botao>
        </form>
        <select value={f('tipo')} onChange={e => mudar({ tipo: e.target.value })} className="campo" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_COMUNICADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={f('ano')} onChange={e => mudar({ ano: e.target.value })} className="campo" aria-label="Ano">
          <option value="">Todos os anos</option>
          {dados?.anos.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div className="mt-6">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<Megaphone />} titulo="Nenhum comunicado encontrado" />
        ) : (
          <>
            <Cartao className="divide-y divide-stone-100">
              {dados.itens.map(c => (
                <Link key={c.id} to={`/app/comunicados/${c.id}`} className="flex items-start gap-3 p-4 hover:bg-stone-50">
                  <div className="w-16 shrink-0 pt-0.5"><SeloOrigem origem={c.origem} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-stone-500">{TIPO_COMUNICADO[c.tipo]}{c.numero ? ` · ${c.numero}` : ''}</p>
                    <p className={cx('text-[15px]', c.lido ? 'text-stone-700' : 'font-semibold text-stone-900')}>{c.titulo}</p>
                    {c.resumo && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{c.resumo}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-stone-500">
                    {data(c.data_publicacao)}
                    <span className="flex items-center gap-1.5">
                      {!!c.tem_arquivo && <Paperclip className="size-3.5" aria-label="Com anexo" />}
                      {!c.lido && <span className="size-2 rounded-full bg-sol-400" aria-label="Não lido" />}
                    </span>
                  </div>
                </Link>
              ))}
            </Cartao>
            <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => mudar({ pagina: String(p) })} />
          </>
        )}
      </div>
    </div>
  )
}
