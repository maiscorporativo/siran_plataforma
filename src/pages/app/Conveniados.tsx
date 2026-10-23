import { useState } from 'react'
import { Clock, Globe, Instagram, MapPin, MapPinned, MessageCircle, Phone, Search, Tractor, Truck, X } from 'lucide-react'
import { qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { linkTelefone, linkWhatsapp, mascaraTelefone } from '../../lib/format'
import { Botao, Cabecalho, Carregando, Cartao, Erro, Etiqueta, Modal, Vazio, cx } from '../../components/ui'
import type { Categoria, Conveniado } from '../../lib/tipos'

export default function Conveniados() {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [cidade, setCidade] = useState('')
  const [flags, setFlags] = useState({ atende_24h: false, entrega_rural: false, atende_propriedade: false })
  const [aberto, setAberto] = useState<Conveniado | null>(null)

  const { dados: filtros } = useApi<{ categorias: Categoria[]; cidades: string[] }>('/conveniados/filtros')
  const { dados, erro, carregando, recarregar } = useApi<Conveniado[]>(`/conveniados${qs({
    q: termo, categoria, cidade,
    atende_24h: flags.atende_24h ? 1 : '', entrega_rural: flags.entrega_rural ? 1 : '', atende_propriedade: flags.atende_propriedade ? 1 : '',
  })}`)

  const alternar = (k: keyof typeof flags) => setFlags(f => ({ ...f, [k]: !f[k] }))
  const temFiltro = termo || categoria || cidade || Object.values(flags).some(Boolean)

  return (
    <div>
      <Cabecalho titulo="Guia de conveniados" descricao="Empresas e profissionais parceiros do SIRAN com vantagens para associados. Apresente sua carteirinha digital." />

      <form onSubmit={e => { e.preventDefault(); setTermo(busca.trim()) }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar farmácia, veterinário, mecânico…" className="campo !pl-10" aria-label="Buscar conveniados" />
        </div>
        <Botao type="submit">Buscar</Botao>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="campo" aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {filtros?.categorias.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.total})</option>)}
        </select>
        <select value={cidade} onChange={e => setCidade(e.target.value)} className="campo" aria-label="Cidade">
          <option value="">Qualquer cidade</option>
          {filtros?.cidades.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ['atende_24h', 'Atende 24 horas', Clock],
          ['entrega_rural', 'Entrega na zona rural', Truck],
          ['atende_propriedade', 'Atende na propriedade', Tractor],
        ] as const).map(([k, rotulo, Icone]) => (
          <button key={k} onClick={() => alternar(k)}
            className={cx('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium',
              flags[k] ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-siran-600')}>
            <Icone className="size-4" /> {rotulo}
          </button>
        ))}
        {temFiltro && (
          <button onClick={() => { setBusca(''); setTermo(''); setCategoria(''); setCidade(''); setFlags({ atende_24h: false, entrega_rural: false, atende_propriedade: false }) }}
            className="inline-flex items-center gap-1 px-2 text-sm text-siran-700 hover:underline"><X className="size-4" /> Limpar</button>
        )}
      </div>

      <div className="mt-6">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.length ? (
          <Vazio icone={<MapPinned />} titulo={temFiltro ? 'Nenhum conveniado encontrado' : 'Em breve, novos conveniados'}>
            {temFiltro ? 'Tente remover algum filtro.' : 'O SIRAN está cadastrando os parceiros da região.'}
          </Vazio>
        ) : (
          <div className={cx('grid gap-4 md:grid-cols-2', carregando && 'opacity-60')}>
            {dados.map(c => <CartaoConveniado key={c.id} c={c} onAbrir={() => setAberto(c)} />)}
          </div>
        )}
      </div>

      <Modal aberto={!!aberto} titulo={aberto?.nome || ''} onFechar={() => setAberto(null)}>
        {aberto && <DetalheConveniado c={aberto} />}
      </Modal>
    </div>
  )
}

function Selos({ c }: { c: Conveniado }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {!!c.atende_24h && <Etiqueta tom="vermelho"><Clock className="size-3" /> 24 horas</Etiqueta>}
      {!!c.entrega_rural && <Etiqueta tom="verde"><Truck className="size-3" /> Entrega rural</Etiqueta>}
      {!!c.atende_propriedade && <Etiqueta tom="azul"><Tractor className="size-3" /> Vai até a propriedade</Etiqueta>}
    </div>
  )
}

function Contatos({ c }: { c: Conveniado }) {
  const whats = linkWhatsapp(c.whatsapp, 'Olá! Sou associado do SIRAN e gostaria de atendimento.')
  return (
    <div className="flex flex-wrap gap-2">
      {whats && <a href={whats} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d55] px-3 py-2 text-sm font-medium text-white hover:bg-[#198a4a]"><MessageCircle className="size-4" /> WhatsApp</a>}
      {c.telefone && <a href={linkTelefone(c.telefone)!} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-siran-900 hover:bg-stone-50"><Phone className="size-4" /> Ligar</a>}
    </div>
  )
}

function CartaoConveniado({ c, onAbrir }: { c: Conveniado; onAbrir: () => void }) {
  return (
    <Cartao className={cx('flex flex-col p-5', !!c.destaque && 'ring-2 ring-sol-400')}>
      <button onClick={onAbrir} className="flex items-start gap-4 text-left">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
          {c.logo ? <img src={c.logo} alt="" className="size-full object-contain p-1" /> : <span className="text-xl font-semibold text-siran-700">{c.nome.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-siran-600">{c.categoria}</p>
          <p className="font-semibold text-stone-900">{c.nome}</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500"><MapPin className="size-3.5" /> {c.cidade}{c.uf ? `/${c.uf}` : ''}</p>
        </div>
      </button>
      {c.beneficio && <p className="mt-4 rounded-lg bg-siran-50 px-3 py-2 text-sm font-medium text-siran-900">🎁 {c.beneficio}</p>}
      <div className="mt-3"><Selos c={c} /></div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <Contatos c={c} />
        <button onClick={onAbrir} className="text-sm font-medium text-siran-700 hover:underline">Detalhes</button>
      </div>
    </Cartao>
  )
}

function DetalheConveniado({ c }: { c: Conveniado }) {
  const endereco = [c.logradouro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`].filter(Boolean).join(' – ')
  const mapa = endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nome} ${endereco}`)}` : null
  return (
    <div className="space-y-4">
      {c.logo && <img src={c.logo} alt="" className="h-20 object-contain" />}
      <p className="text-sm font-medium uppercase tracking-wide text-siran-600">{c.categoria}</p>
      {c.beneficio && <div className="rounded-xl bg-siran-50 p-4"><p className="text-xs font-medium uppercase text-siran-700">Vantagem para associados</p><p className="mt-1 font-medium text-siran-900">{c.beneficio}</p></div>}
      <Selos c={c} />
      {c.descricao && <p className="whitespace-pre-line text-[15px] text-stone-700">{c.descricao}</p>}
      <dl className="space-y-3 text-sm">
        {endereco && <div><dt className="text-stone-500">Endereço</dt><dd className="font-medium">{endereco} {mapa && <a href={mapa} target="_blank" rel="noreferrer" className="ml-1 text-siran-700 hover:underline">ver no mapa</a>}</dd></div>}
        {c.area_atendimento && <div><dt className="text-stone-500">Região atendida</dt><dd className="font-medium">{c.area_atendimento}</dd></div>}
        {c.horario && <div><dt className="text-stone-500">Horário</dt><dd className="font-medium">{c.horario}</dd></div>}
        {(c.telefone || c.whatsapp) && <div><dt className="text-stone-500">Telefones</dt><dd className="font-medium">{[c.whatsapp, c.telefone].filter(Boolean).map(t => mascaraTelefone(t!)).join(' · ')}</dd></div>}
        {c.email && <div><dt className="text-stone-500">E-mail</dt><dd><a href={`mailto:${c.email}`} className="font-medium text-siran-700 hover:underline">{c.email}</a></dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Contatos c={c} />
        {c.site && <a href={c.site.startsWith('http') ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-siran-900"><Globe className="size-4" /> Site</a>}
        {c.instagram && <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-siran-900"><Instagram className="size-4" /> @{c.instagram}</a>}
      </div>
    </div>
  )
}
