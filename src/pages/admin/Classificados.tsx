import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ImageOff, MessageCircle, Store, Trash2, XCircle } from 'lucide-react'
import { api, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { dataHora, linkWhatsapp, preco } from '../../lib/format'
import { AreaTexto, Botao, Cabecalho, Carregando, Cartao, Erro, Modal, Paginacao, Vazio, cx, useConfirmacao, useToast } from '../../components/ui'
import { StatusAnuncio } from '../../components/Status'
import { TIPO_ANUNCIO, type Classificado, type Paginado } from '../../lib/tipos'

type Item = Classificado & { associado_id: number; anunciante: string }
type Detalhe = Classificado & { matricula: string; anunciante_whatsapp: string | null; associado_id: number }

const ABAS = [['pendente', 'Aguardando moderação'], ['aprovado', 'Publicados'], ['reprovado', 'Reprovados'], ['expirado', 'Expirados'], ['', 'Todos']]

/* Motivos frequentes para agilizar a moderação */
const MOTIVOS = [
  'Faltam fotos do produto.',
  'Descrição incompleta: informe estado de conservação e detalhes.',
  'Item não permitido nos classificados do sindicato.',
  'Preço ou contato inconsistente.',
]

export default function AdmClassificados() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'pendente'
  const pagina = params.get('pagina') || ''
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Item>>(`/admin/classificados${qs({ status, pagina })}`)
  const [aberto, setAberto] = useState<number | null>(null)

  return (
    <div>
      <Cabecalho titulo="Classificados" descricao="Revise os anúncios antes de publicar para os associados." />
      <div className="mb-5 flex flex-wrap gap-2">
        {ABAS.map(([k, v]) => (
          <button key={k || 'todos'} onClick={() => setParams(k ? { status: k } : { status: '' })}
            className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', status === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{v}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
        <Vazio icone={<Store />} titulo={status === 'pendente' ? 'Nenhum anúncio aguardando moderação 🎉' : 'Nenhum anúncio'} />
      ) : (
        <>
          <div className="space-y-3">
            {dados.itens.map(c => (
              <Cartao key={c.id} className="flex cursor-pointer gap-4 p-4 hover:border-siran-600" onClick={() => setAberto(c.id)}>
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {c.capa ? <img src={c.capa} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-stone-300"><ImageOff /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><StatusAnuncio status={c.status_exibido} /><span className="text-xs text-stone-500">{c.categoria}</span></div>
                  <p className="mt-1 font-medium text-stone-900">{c.titulo}</p>
                  <p className="text-sm text-stone-600">{preco(c)} · {c.anunciante} · {c.cidade}</p>
                  <p className="text-xs text-stone-500">Atualizado {dataHora(c.updated_at)}{c.status_exibido === 'aprovado' ? ` · ${c.visualizacoes} visualizações` : ''}</p>
                </div>
              </Cartao>
            ))}
          </div>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => setParams({ status, pagina: String(p) })} />
        </>
      )}
      {aberto && <Moderar id={aberto} onFechar={() => setAberto(null)} onConcluir={() => { setAberto(null); recarregar() }} />}
    </div>
  )
}

function Moderar({ id, onFechar, onConcluir }: { id: number; onFechar: () => void; onConcluir: () => void }) {
  const { dados: c, carregando } = useApi<Detalhe>(`/admin/classificados/${id}`)
  const [motivo, setMotivo] = useState('')
  const [reprovando, setReprovando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function moderar(decisao: 'aprovar' | 'reprovar') {
    setEnviando(true)
    try {
      await api(`/admin/classificados/${id}/moderar`, { method: 'POST', body: { decisao, motivo } })
      toast(decisao === 'aprovar' ? 'Anúncio publicado.' : 'Anúncio devolvido ao associado.')
      onConcluir()
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  async function excluir() {
    if (!(await confirmar('Excluir anúncio', 'O anúncio e as fotos serão apagados definitivamente.', 'Excluir', true))) return
    try {
      await api(`/admin/classificados/${id}`, { method: 'DELETE' })
      toast('Anúncio excluído.')
      onConcluir()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <Modal aberto titulo="Moderação de anúncio" onFechar={onFechar} largura="max-w-2xl"
      rodape={c && <>
        <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<Trash2 className="size-4" />} onClick={excluir}>Excluir</Botao>
        {!reprovando && c.status !== 'reprovado' && <Botao variante="secundario" icone={<XCircle className="size-4" />} onClick={() => setReprovando(true)}>Reprovar</Botao>}
        {reprovando && <Botao variante="perigo" carregando={enviando} disabled={!motivo.trim()} onClick={() => moderar('reprovar')}>Confirmar reprovação</Botao>}
        {!reprovando && c.status_exibido !== 'aprovado' && <Botao carregando={enviando} icone={<CheckCircle2 className="size-4" />} onClick={() => moderar('aprovar')}>Aprovar e publicar</Botao>}
      </>}>
      {carregando || !c ? <Carregando /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><StatusAnuncio status={c.status_exibido} /><span className="text-sm text-stone-500">{c.categoria} · {TIPO_ANUNCIO[c.tipo]}</span></div>
          <h3 className="text-lg font-semibold">{c.titulo}</h3>
          {c.fotos && c.fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {c.fotos.map(f => <a key={f.id} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="" className="aspect-square w-full rounded-lg object-cover" /></a>)}
            </div>
          )}
          <p className="text-xl font-semibold text-siran-900">{preco(c)}</p>
          <p className="whitespace-pre-line text-sm text-stone-700">{c.descricao}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {c.marca && <div><dt className="text-stone-500">Marca/modelo</dt><dd>{c.marca} {c.modelo}</dd></div>}
            {c.ano && <div><dt className="text-stone-500">Ano</dt><dd>{c.ano}</dd></div>}
            <div><dt className="text-stone-500">Local</dt><dd>{c.cidade}/{c.uf}</dd></div>
            <div><dt className="text-stone-500">Anunciante</dt><dd><Link to={`/admin/associados/${c.associado_id}`} className="text-siran-700 hover:underline">{c.anunciante}</Link> (mat. {c.matricula})</dd></div>
          </dl>
          {linkWhatsapp(c.contato_whatsapp) && (
            <a href={linkWhatsapp(c.contato_whatsapp, `Olá! Sobre seu anúncio "${c.titulo}" nos classificados do SIRAN: `)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-siran-700 hover:underline">
              <MessageCircle className="size-4" /> Falar com o anunciante
            </a>
          )}
          {c.motivo_reprovacao && !reprovando && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Motivo da reprovação: {c.motivo_reprovacao}</p>}
          {reprovando && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS.map(m => <button key={m} onClick={() => setMotivo(m)} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs hover:border-siran-600">{m}</button>)}
              </div>
              <AreaTexto rotulo="Motivo (o associado verá esta mensagem)" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} />
            </div>
          )}
        </div>
      )}
      {elemento}
    </Modal>
  )
}
