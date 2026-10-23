import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, ImageOff, MapPin, MessageCircle, Pencil, Phone, ShieldAlert } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { data, linkTelefone, linkWhatsapp, mascaraTelefone, preco } from '../../lib/format'
import { Aviso, BotaoLink, Cabecalho, Carregando, Cartao, Erro, Etiqueta } from '../../components/ui'
import { StatusAnuncio } from '../../components/Status'
import { TIPO_ANUNCIO, type Classificado } from '../../lib/tipos'

const CONDICAO: Record<string, string> = { novo: 'Novo', usado: 'Usado' }
const PRECO_TIPO: Record<string, string> = { negociavel: 'Negociável', fixo: '' }

export default function ClassificadoDetalhe() {
  const { id } = useParams()
  const { dados: c, erro, carregando, recarregar } = useApi<Classificado & { anunciante_cidade: string | null }>(`/classificados/${id}`)
  const [foto, setFoto] = useState(0)

  if (carregando && !c) return <Carregando />
  if (erro || !c) return <><Cabecalho titulo="Anúncio" voltar="/app/classificados" /><Erro mensagem={erro || ''} tentar={recarregar} /></>

  const fotos = c.fotos || []
  const whats = linkWhatsapp(c.contato_whatsapp, `Olá! Vi seu anúncio "${c.titulo}" nos classificados do SIRAN. Ainda está disponível?`)
  const detalhes = [
    ['Categoria', c.categoria],
    ['Tipo', TIPO_ANUNCIO[c.tipo]],
    ['Condição', c.condicao ? CONDICAO[c.condicao] : null],
    ['Marca', c.marca], ['Modelo', c.modelo], ['Ano', c.ano],
  ].filter(([, v]) => v)

  return (
    <div>
      <Cabecalho titulo={c.titulo} voltar={c.meu ? '/app/classificados/meus' : '/app/classificados'} />

      {c.meu && (
        <div className="mb-5">
          <Aviso tom={c.status_exibido === 'reprovado' ? 'vermelho' : 'azul'} titulo="Este é o seu anúncio"
            acao={<BotaoLink to={`/app/classificados/${c.id}/editar`} variante="secundario" icone={<Pencil className="size-4" />}>Editar</BotaoLink>}>
            <span className="inline-flex flex-wrap items-center gap-2">Situação: <StatusAnuncio status={c.status_exibido} />
              {c.status_exibido === 'aprovado' && <>· {c.visualizacoes} visualizações · expira em {data(c.expira_em)}</>}</span>
            {c.motivo_reprovacao && c.status_exibido === 'reprovado' && <p className="mt-1">Motivo: {c.motivo_reprovacao}</p>}
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Galeria */}
        <div className="lg:col-span-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
            {fotos.length ? (
              <img src={fotos[foto]?.url} alt={`Foto ${foto + 1} de ${c.titulo}`} className="size-full object-contain" />
            ) : (
              <div className="flex size-full items-center justify-center text-stone-300"><ImageOff className="size-14" /></div>
            )}
            {fotos.length > 1 && (
              <>
                <button onClick={() => setFoto((foto - 1 + fotos.length) % fotos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow" aria-label="Foto anterior"><ChevronLeft className="size-5" /></button>
                <button onClick={() => setFoto((foto + 1) % fotos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow" aria-label="Próxima foto"><ChevronRight className="size-5" /></button>
                <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">{foto + 1}/{fotos.length}</span>
              </>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {fotos.map((f, i) => (
                <button key={f.id} onClick={() => setFoto(i)} className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === foto ? 'border-siran-600' : 'border-transparent'}`}>
                  <img src={f.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <Cartao className="mt-6 p-5">
            <h2 className="mb-2 font-semibold">Descrição</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-700">{c.descricao}</p>
          </Cartao>
        </div>

        {/* Preço e contato */}
        <div className="space-y-4 lg:col-span-2">
          <Cartao className="p-5">
            <p className="text-3xl font-semibold text-siran-900">{preco(c)}</p>
            {PRECO_TIPO[c.preco_tipo] && <Etiqueta tom="verde" className="mt-1">{PRECO_TIPO[c.preco_tipo]}</Etiqueta>}
            <p className="mt-3 flex items-center gap-1.5 text-sm text-stone-600"><MapPin className="size-4" /> {c.cidade}{c.uf ? `/${c.uf}` : ''}</p>
            <p className="mt-1 text-xs text-stone-500">Publicado em {data(c.publicado_em || c.created_at)}</p>

            <div className="mt-5 border-t border-stone-100 pt-4">
              <p className="text-xs uppercase tracking-wide text-stone-500">Anunciante</p>
              <p className="font-medium text-stone-900">{c.anunciante}</p>
              <p className="text-sm text-stone-500">Associado SIRAN</p>
            </div>

            {!c.meu && (
              <div className="mt-5 space-y-2">
                {whats && (
                  <a href={whats} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f9d55] px-4 py-3 font-medium text-white hover:bg-[#198a4a]">
                    <MessageCircle className="size-5" /> Conversar no WhatsApp
                  </a>
                )}
                {c.contato_telefone && (
                  <a href={linkTelefone(c.contato_telefone)!} className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-siran-900 hover:bg-stone-50">
                    <Phone className="size-5" /> Ligar {mascaraTelefone(c.contato_telefone)}
                  </a>
                )}
              </div>
            )}
          </Cartao>

          {detalhes.length > 0 && (
            <Cartao className="p-5">
              <h2 className="mb-3 font-semibold">Detalhes</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {detalhes.map(([k, v]) => (
                  <div key={String(k)}><dt className="text-stone-500">{k}</dt><dd className="font-medium text-stone-800">{v}</dd></div>
                ))}
              </dl>
            </Cartao>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-stone-100 p-4 text-xs text-stone-600">
            <ShieldAlert className="size-4 shrink-0" />
            <p>A negociação é feita diretamente entre os associados. Confira o produto pessoalmente e desconfie de pedidos de pagamento antecipado.</p>
          </div>
          {!c.meu && !!c.visualizacoes && <p className="flex items-center gap-1 text-xs text-stone-400"><Eye className="size-3.5" /> {c.visualizacoes} visualizações</p>}
        </div>
      </div>
    </div>
  )
}
