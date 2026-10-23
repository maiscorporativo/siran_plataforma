import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, Store, X } from 'lucide-react'
import { qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { BotaoLink, Botao, Cabecalho, Carregando, Erro, Paginacao, Vazio, cx } from '../../components/ui'
import { CartaoAnuncio } from '../../components/CartaoAnuncio'
import type { Categoria, Classificado, Paginado } from '../../lib/tipos'

export default function Classificados() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const filtro = (k: string) => params.get(k) || ''

  const { dados: categorias } = useApi<Categoria[]>('/classificados/categorias')
  const caminho = `/classificados${qs({
    q: filtro('q'), categoria: filtro('categoria'), tipo: filtro('tipo'), cidade: filtro('cidade'),
    ordem: filtro('ordem'), pagina: filtro('pagina'),
  })}`
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Classificado> & { cidades: string[] }>(caminho)

  const mudar = (mudancas: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(mudancas)) v ? p.set(k, v) : p.delete(k)
    if (!('pagina' in mudancas)) p.delete('pagina')
    setParams(p)
  }

  const temFiltro = ['q', 'categoria', 'tipo', 'cidade'].some(k => params.get(k))

  return (
    <div>
      <Cabecalho
        titulo="Classificados"
        descricao="Compre, venda e contrate serviços entre associados do SIRAN."
        acoes={<>
          <BotaoLink to="/app/classificados/meus" variante="secundario">Meus anúncios</BotaoLink>
          <BotaoLink to="/app/classificados/novo" icone={<Plus className="size-4" />}>Anunciar</BotaoLink>
        </>}
      />

      {/* Busca */}
      <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar trator, novilha, plantadeira…" className="campo !pl-10" aria-label="Buscar anúncios" />
        </div>
        <Botao type="submit">Buscar</Botao>
        <Botao type="button" variante="secundario" className="lg:hidden" onClick={() => setFiltrosAbertos(!filtrosAbertos)} aria-label="Filtros" icone={<SlidersHorizontal className="size-4" />} />
      </form>

      {/* Categorias */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <button onClick={() => mudar({ categoria: '' })} className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium', !filtro('categoria') ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>Todas</button>
        {categorias?.map(c => (
          <button key={c.id} onClick={() => mudar({ categoria: String(c.id) })}
            className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium', filtro('categoria') === String(c.id) ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-siran-600')}>
            {c.nome}{!!c.total && <span className="ml-1 opacity-70">({c.total})</span>}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className={cx('mt-4 grid gap-3 sm:grid-cols-3', !filtrosAbertos && 'hidden lg:grid')}>
        <select value={filtro('tipo')} onChange={e => mudar({ tipo: e.target.value })} className="campo" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          <option value="venda">À venda</option>
          <option value="servico">Serviços oferecidos</option>
          <option value="procura">Procura-se</option>
          <option value="troca">Troca</option>
        </select>
        <select value={filtro('cidade')} onChange={e => mudar({ cidade: e.target.value })} className="campo" aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {dados?.cidades.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filtro('ordem')} onChange={e => mudar({ ordem: e.target.value })} className="campo" aria-label="Ordenar">
          <option value="">Mais recentes</option>
          <option value="menor_preco">Menor preço</option>
          <option value="maior_preco">Maior preço</option>
        </select>
      </div>

      {temFiltro && (
        <button onClick={() => { setBusca(''); setParams(new URLSearchParams()) }} className="mt-3 inline-flex items-center gap-1 text-sm text-siran-700 hover:underline">
          <X className="size-4" /> Limpar filtros
        </button>
      )}

      <div className="mt-6">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<Store />} titulo={temFiltro ? 'Nenhum anúncio encontrado' : 'Ainda não há anúncios publicados'}>
            {temFiltro ? 'Tente outra busca ou remova os filtros.' : 'Seja o primeiro a anunciar para os associados.'}
          </Vazio>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-500">{dados.total} anúncio(s)</p>
            <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4', carregando && 'opacity-60')}>
              {dados.itens.map(c => <CartaoAnuncio key={c.id} c={c} />)}
            </div>
            <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => mudar({ pagina: String(p) })} />
          </>
        )}
      </div>
    </div>
  )
}
