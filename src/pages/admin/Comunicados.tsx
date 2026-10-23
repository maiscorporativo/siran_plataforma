import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, FileText, Megaphone, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { abrirArquivo, api, formData, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Marcador, Modal, Paginacao, Selecao, Vazio, useConfirmacao, useToast } from '../../components/ui'
import { SeloOrigem } from '../../components/Status'
import { ORIGEM_COMUNICADO, TIPO_COMUNICADO, type Comunicado, type Paginado } from '../../lib/tipos'

export default function AdmComunicados() {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [origem, setOrigem] = useState('')
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState<number | 'novo' | null>(null)
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Comunicado> & { associados_ativos: number }>(`/admin/comunicados${qs({ q: termo, origem, pagina })}`)

  return (
    <div>
      <Cabecalho titulo="Ofícios e comunicados" descricao="Publique ofícios e circulares da FAESP, SENAR e CNA e comunicados do próprio SIRAN."
        acoes={<Botao icone={<Plus className="size-4" />} onClick={() => setEditando('novo')}>Publicar</Botao>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px]">
        <form onSubmit={e => { e.preventDefault(); setTermo(busca.trim()); setPagina(1) }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título ou número" className="campo !pl-10" aria-label="Buscar" />
        </form>
        <select value={origem} onChange={e => { setOrigem(e.target.value); setPagina(1) }} className="campo" aria-label="Origem">
          <option value="">Todas as origens</option>
          {Object.entries(ORIGEM_COMUNICADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
        <Vazio icone={<Megaphone />} titulo="Nenhum comunicado publicado" />
      ) : (
        <>
          <Cartao className="divide-y divide-stone-100">
            {dados.itens.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-16 shrink-0"><SeloOrigem origem={c.origem} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{c.titulo} {!c.publicado && <Etiqueta>Rascunho</Etiqueta>} {!!c.destaque && <Etiqueta tom="amarelo">Destaque</Etiqueta>}</p>
                  <p className="text-sm text-stone-500">{TIPO_COMUNICADO[c.tipo]}{c.numero ? ` · ${c.numero}` : ''} · {data(c.data_publicacao)}{c.tem_arquivo ? ' · PDF' : ''}</p>
                </div>
                <span className="hidden items-center gap-1 text-sm text-stone-500 sm:flex" title="Associados que abriram">
                  <Eye className="size-4" /> {c.leituras}/{dados.associados_ativos}
                </span>
                <Botao variante="secundario" tamanho="sm" icone={<Pencil className="size-4" />} onClick={() => setEditando(c.id)}>Editar</Botao>
              </div>
            ))}
          </Cartao>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={setPagina} />
        </>
      )}
      {editando && <FormComunicado id={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar() }} />}
    </div>
  )
}

function FormComunicado({ id, onFechar, onSalvo }: { id: number | null; onFechar: () => void; onSalvo: () => void }) {
  const { dados: existente, carregando } = useApi<Comunicado & { arquivo: string | null }>(id ? `/admin/comunicados/${id}` : null)
  const [d, setD] = useState<Record<string, string> | null>(null)
  const [flags, setFlags] = useState({ destaque: false, publicado: true, avisar_associados: false })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [removerArquivo, setRemoverArquivo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  // Inicializa o formulário quando o comunicado carrega (ou na hora, se for novo)
  if (!d && (!id || existente)) {
    const hoje = new Date()
    setD({
      origem: existente?.origem || 'FAESP', tipo: existente?.tipo || 'oficio', numero: existente?.numero || '', titulo: existente?.titulo || '',
      resumo: existente?.resumo || '', conteudo: existente?.conteudo || '',
      data_publicacao: existente?.data_publicacao?.slice(0, 10) || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
    })
    if (existente) setFlags({ destaque: !!existente.destaque, publicado: !!existente.publicado, avisar_associados: false })
  }

  const set = (k: string, v: string) => setD(x => ({ ...x!, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const form = formData({ ...d!, ...flags, arquivo, remover_arquivo: removerArquivo })
      if (id) await api(`/admin/comunicados/${id}`, { method: 'PUT', form })
      else await api('/admin/comunicados', { method: 'POST', form })
      toast(flags.publicado ? 'Comunicado publicado.' : 'Rascunho salvo.')
      onSalvo()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function excluir() {
    if (!id || !(await confirmar('Excluir comunicado', 'O comunicado e o anexo serão apagados.', 'Excluir', true))) return
    try {
      await api(`/admin/comunicados/${id}`, { method: 'DELETE' })
      toast('Comunicado excluído.')
      onSalvo()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <Modal aberto titulo={id ? 'Editar comunicado' : 'Publicar comunicado'} onFechar={onFechar} largura="max-w-2xl"
      rodape={<>
        {id && <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<Trash2 className="size-4" />} onClick={excluir}>Excluir</Botao>}
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao type="submit" form="form-comunicado" carregando={enviando} icone={flags.publicado ? <Megaphone className="size-4" /> : <EyeOff className="size-4" />}>
          {flags.publicado ? 'Publicar' : 'Salvar rascunho'}
        </Botao>
      </>}>
      {(id && carregando) || !d ? <Carregando /> : (
        <form id="form-comunicado" onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao rotulo="Origem" value={d.origem} onChange={e => set('origem', e.target.value)}>
              {Object.entries(ORIGEM_COMUNICADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
            <Selecao rotulo="Tipo" value={d.tipo} onChange={e => set('tipo', e.target.value)}>
              {Object.entries(TIPO_COMUNICADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
            <Entrada rotulo="Data" type="date" value={d.data_publicacao} onChange={e => set('data_publicacao', e.target.value)} required />
          </div>
          <Entrada rotulo="Número" value={d.numero} onChange={e => set('numero', e.target.value)} placeholder="Ex.: Ofício Circular nº 123/2026" />
          <Entrada rotulo="Título / assunto" value={d.titulo} onChange={e => set('titulo', e.target.value)} required />
          <AreaTexto rotulo="Resumo" value={d.resumo} onChange={e => set('resumo', e.target.value)} rows={2} maxLength={500} dica="Aparece na lista. Diga em uma ou duas frases o que o associado precisa saber." />
          <AreaTexto rotulo="Texto completo (opcional)" value={d.conteudo} onChange={e => set('conteudo', e.target.value)} rows={6} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">Documento oficial (PDF)</p>
            {existente?.arquivo && !removerArquivo && !arquivo && (
              <div className="mb-2 flex items-center gap-3 text-sm">
                <button type="button" onClick={() => abrirArquivo(`/admin/comunicados/${id}/arquivo`).catch(e => toast(e.message, 'erro'))} className="inline-flex items-center gap-1.5 font-medium text-siran-700 hover:underline">
                  <FileText className="size-4" /> {existente.arquivo_nome}
                </button>
                <button type="button" onClick={() => setRemoverArquivo(true)} className="text-red-700 hover:underline">remover</button>
              </div>
            )}
            <input type="file" accept="application/pdf" onChange={e => setArquivo(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-siran-100 file:px-4 file:py-2 file:font-medium file:text-siran-900" />
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Marcador rotulo="Publicado" descricao="Desmarque para salvar como rascunho" checked={flags.publicado} onChange={v => setFlags(f => ({ ...f, publicado: v }))} />
            <Marcador rotulo="Destaque" descricao="Fica no topo do painel do associado" checked={flags.destaque} onChange={v => setFlags(f => ({ ...f, destaque: v }))} />
            {flags.publicado && (
              <Marcador rotulo="Avisar os associados por WhatsApp e e-mail" descricao="Envia aos associados ativos, um de cada vez. Quem já recebeu este aviso não recebe de novo."
                checked={flags.avisar_associados} onChange={v => setFlags(f => ({ ...f, avisar_associados: v }))} />
            )}
          </div>
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        </form>
      )}
      {elemento}
    </Modal>
  )
}
