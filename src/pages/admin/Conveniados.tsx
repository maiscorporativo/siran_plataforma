import { useRef, useState, type FormEvent } from 'react'
import { ImagePlus, MapPinned, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, formData, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { reduzirImagem } from '../../lib/imagem'
import { mascaraTelefone, UFS } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Marcador, Modal, Selecao, Vazio, useConfirmacao, useToast } from '../../components/ui'
import type { Categoria, Conveniado } from '../../lib/tipos'

export default function AdmConveniados() {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [editando, setEditando] = useState<Conveniado | 'novo' | null>(null)
  const { dados, erro, carregando, recarregar } = useApi<Conveniado[]>(`/admin/conveniados${qs({ q: termo })}`)
  const { dados: categorias } = useApi<Categoria[]>('/admin/categorias?escopo=conveniado')

  return (
    <div>
      <Cabecalho titulo="Conveniados" descricao="Empresas e profissionais parceiros que oferecem vantagens aos associados."
        acoes={<Botao icone={<Plus className="size-4" />} onClick={() => setEditando('novo')}>Novo conveniado</Botao>} />
      <form onSubmit={e => { e.preventDefault(); setTermo(busca.trim()) }} className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou cidade" className="campo !pl-10" aria-label="Buscar" />
      </form>

      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.length ? (
        <Vazio icone={<MapPinned />} titulo="Nenhum conveniado cadastrado">Cadastre farmácias, veterinários, mecânicos e demais parceiros.</Vazio>
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {dados.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200">
                {c.logo ? <img src={c.logo} alt="" className="size-full object-contain p-0.5" /> : <span className="text-sm font-semibold text-siran-700">{c.nome.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{c.nome} {!c.ativo && <Etiqueta>Inativo</Etiqueta>} {!!c.destaque && <Etiqueta tom="amarelo">Destaque</Etiqueta>}</p>
                <p className="truncate text-sm text-stone-500">{c.categoria} · {c.cidade}{c.beneficio ? ` · ${c.beneficio}` : ''}</p>
              </div>
              <Botao variante="secundario" tamanho="sm" icone={<Pencil className="size-4" />} onClick={() => setEditando(c)}>Editar</Botao>
            </div>
          ))}
        </Cartao>
      )}

      {editando && <FormConveniado c={editando === 'novo' ? null : editando} categorias={categorias || []}
        onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar() }} />}
    </div>
  )
}

function FormConveniado({ c, categorias, onFechar, onSalvo }: { c: Conveniado | null; categorias: Categoria[]; onFechar: () => void; onSalvo: () => void }) {
  const [d, setD] = useState<Record<string, string>>(() => ({
    nome: c?.nome || '', categoria_id: String(c?.categoria_id || ''), descricao: c?.descricao || '', beneficio: c?.beneficio || '',
    logradouro: c?.logradouro || '', cidade: c?.cidade || 'Araçatuba', uf: c?.uf || 'SP', area_atendimento: c?.area_atendimento || '',
    telefone: mascaraTelefone(c?.telefone || ''), whatsapp: mascaraTelefone(c?.whatsapp || ''), email: c?.email || '', site: c?.site || '',
    instagram: c?.instagram || '', horario: c?.horario || '',
  }))
  const [flags, setFlags] = useState({
    atende_24h: !!c?.atende_24h, entrega_rural: !!c?.entrega_rural, atende_propriedade: !!c?.atende_propriedade,
    destaque: !!c?.destaque, ativo: c ? !!c.ativo : true,
  })
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(c?.logo || null)
  const [removerLogo, setRemoverLogo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))
  const flag = (k: keyof typeof flags) => (v: boolean) => setFlags(f => ({ ...f, [k]: v }))

  async function escolherLogo(f: File | undefined) {
    if (!f) return
    const reduzida = await reduzirImagem(f, 600, 0.9)
    setLogo(reduzida)
    setPreview(URL.createObjectURL(reduzida))
    setRemoverLogo(false)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const form = formData({ ...d, ...flags, logo, remover_logo: removerLogo })
      if (c) await api(`/admin/conveniados/${c.id}`, { method: 'PUT', form })
      else await api('/admin/conveniados', { method: 'POST', form })
      toast('Conveniado salvo.')
      onSalvo()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function excluir() {
    if (!c || !(await confirmar('Excluir conveniado', `Excluir ${c.nome}? Para apenas ocultar, desmarque "Ativo".`, 'Excluir', true))) return
    try {
      await api(`/admin/conveniados/${c.id}`, { method: 'DELETE' })
      toast('Conveniado excluído.')
      onSalvo()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <Modal aberto titulo={c ? 'Editar conveniado' : 'Novo conveniado'} onFechar={onFechar} largura="max-w-2xl"
      rodape={<>
        {c && <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<Trash2 className="size-4" />} onClick={excluir}>Excluir</Botao>}
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao type="submit" form="form-conveniado" carregando={enviando}>Salvar</Botao>
      </>}>
      <form id="form-conveniado" onSubmit={salvar} className="space-y-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => input.current?.click()} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 hover:border-siran-600">
            {preview && !removerLogo ? <img src={preview} alt="" className="size-full object-contain p-1" /> : <ImagePlus className="size-6 text-stone-400" />}
          </button>
          <div className="text-sm">
            <p className="font-medium">Logo</p>
            <p className="text-stone-500">PNG ou JPG, de preferência quadrado.</p>
            {preview && !removerLogo && <button type="button" onClick={() => { setRemoverLogo(true); setLogo(null) }} className="text-red-700 hover:underline">Remover logo</button>}
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={e => escolherLogo(e.target.files?.[0])} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada rotulo="Nome" value={d.nome} onChange={e => set('nome', e.target.value)} required />
          <Selecao rotulo="Categoria" value={d.categoria_id} onChange={e => set('categoria_id', e.target.value)} required>
            <option value="">Escolha…</option>
            {categorias.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Selecao>
          <Entrada rotulo="Vantagem para associados" className="sm:col-span-2" value={d.beneficio} onChange={e => set('beneficio', e.target.value)} placeholder="Ex.: 10% de desconto e entrega grátis na zona rural" />
        </div>
        <AreaTexto rotulo="Descrição" value={d.descricao} onChange={e => set('descricao', e.target.value)} rows={3} placeholder="Serviços oferecidos, especialidades, formas de pagamento…" />
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          <Marcador rotulo="Atende 24 horas" checked={flags.atende_24h} onChange={flag('atende_24h')} />
          <Marcador rotulo="Entrega na zona rural" checked={flags.entrega_rural} onChange={flag('entrega_rural')} />
          <Marcador rotulo="Atende na propriedade" checked={flags.atende_propriedade} onChange={flag('atende_propriedade')} />
          <Marcador rotulo="Destaque no guia" checked={flags.destaque} onChange={flag('destaque')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-6">
          <Entrada rotulo="Endereço" className="sm:col-span-6" value={d.logradouro} onChange={e => set('logradouro', e.target.value)} />
          <Entrada rotulo="Cidade" className="sm:col-span-4" value={d.cidade} onChange={e => set('cidade', e.target.value)} />
          <Selecao rotulo="UF" className="sm:col-span-2" value={d.uf} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
          <Entrada rotulo="Cidades atendidas" className="sm:col-span-6" value={d.area_atendimento} onChange={e => set('area_atendimento', e.target.value)} placeholder="Ex.: Araçatuba, Birigui, Guararapes, Santo Antônio do Aracanguá" dica="O associado encontra o conveniado ao filtrar por qualquer uma destas cidades." />
          <Entrada rotulo="WhatsApp" className="sm:col-span-3" value={d.whatsapp} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
          <Entrada rotulo="Telefone" className="sm:col-span-3" value={d.telefone} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
          <Entrada rotulo="Horário de atendimento" className="sm:col-span-6" value={d.horario} onChange={e => set('horario', e.target.value)} placeholder="Seg a sex 8h–18h, sáb 8h–12h" />
          <Entrada rotulo="E-mail" className="sm:col-span-2" value={d.email} onChange={e => set('email', e.target.value)} />
          <Entrada rotulo="Site" className="sm:col-span-2" value={d.site} onChange={e => set('site', e.target.value)} />
          <Entrada rotulo="Instagram" className="sm:col-span-2" value={d.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@perfil" />
        </div>
        <Marcador rotulo="Ativo (aparece para os associados)" checked={flags.ativo} onChange={flag('ativo')} />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      </form>
      {elemento}
    </Modal>
  )
}
