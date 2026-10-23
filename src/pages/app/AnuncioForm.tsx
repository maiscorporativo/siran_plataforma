import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Send, X } from 'lucide-react'
import { api, formData } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAssociado } from '../../lib/auth'
import { reduzirImagem } from '../../lib/imagem'
import { mascaraTelefone, soDigitos, UFS } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Selecao } from '../../components/ui'
import type { Categoria, Classificado } from '../../lib/tipos'

type Foto = { id?: number; url: string; arquivo?: File }

export default function AnuncioForm() {
  const { id } = useParams()
  const editando = !!id
  const navegar = useNavigate()
  const { usuario } = useAssociado()
  const { dados: categorias } = useApi<Categoria[]>('/classificados/categorias')
  const { dados: existente, carregando } = useApi<Classificado>(editando ? `/classificados/${id}` : null)
  const { dados: meus } = useApi<{ max_fotos: number }>('/classificados/meus')
  const maxFotos = meus?.max_fotos || 8

  const [f, setF] = useState<Record<string, string>>({
    tipo: 'venda', preco_tipo: 'fixo', condicao: 'usado', uf: usuario?.uf || 'SP', cidade: usuario?.cidade || '',
    contato_whatsapp: mascaraTelefone(usuario?.whatsapp || ''), contato_telefone: '',
  })
  const [fotos, setFotos] = useState<Foto[]>([])
  const [removidas, setRemovidas] = useState<number[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!existente) return
    setF({
      categoria_id: String(existente.categoria_id || ''), tipo: existente.tipo, titulo: existente.titulo, descricao: existente.descricao || '',
      preco: existente.preco ? String(existente.preco).replace('.', ',') : '', preco_tipo: existente.preco_tipo,
      condicao: existente.condicao || 'nao_se_aplica', marca: existente.marca || '', modelo: existente.modelo || '', ano: existente.ano ? String(existente.ano) : '',
      cidade: existente.cidade || '', uf: existente.uf || 'SP',
      contato_whatsapp: mascaraTelefone(existente.contato_whatsapp || ''), contato_telefone: mascaraTelefone(existente.contato_telefone || ''),
    })
    setFotos((existente.fotos || []).map(x => ({ id: x.id, url: x.url })))
  }, [existente])

  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }))
  const ehMaquina = ['maquinas', 'implementos', 'veiculos', 'equipamentos'].includes(categorias?.find(c => String(c.id) === f.categoria_id)?.slug || '')

  async function adicionarFotos(files: FileList | null) {
    if (!files) return
    const livres = maxFotos - fotos.length
    const novas = await Promise.all(Array.from(files).slice(0, livres).map(async a => {
      const arquivo = await reduzirImagem(a)
      return { url: URL.createObjectURL(arquivo), arquivo }
    }))
    setFotos(x => [...x, ...novas])
    if (inputFoto.current) inputFoto.current.value = ''
  }

  function removerFoto(i: number) {
    const foto = fotos[i]
    if (foto.id) setRemovidas(r => [...r, foto.id!])
    setFotos(x => x.filter((_, j) => j !== i))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!soDigitos(f.contato_whatsapp) && !soDigitos(f.contato_telefone)) return setErro('Informe um WhatsApp ou telefone para contato.')
    setEnviando(true)
    try {
      const form = formData({ ...f, remover_fotos: JSON.stringify(removidas) })
      for (const foto of fotos) if (foto.arquivo) form.append('fotos', foto.arquivo)
      if (editando) await api(`/classificados/${id}`, { method: 'PUT', form })
      else await api('/classificados', { method: 'POST', form })
      navegar('/app/classificados/meus', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } finally {
      setEnviando(false)
    }
  }

  if (editando && carregando) return <Carregando />

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo={editando ? 'Editar anúncio' : 'Novo anúncio'} voltar="/app/classificados/meus"
        descricao="Seu anúncio será revisado pela equipe do SIRAN antes de aparecer para os associados." />

      {usuario?.situacao === 'vencido' && (
        <div className="mb-5"><Aviso tom="vermelho" titulo="Credenciamento vencido">Faça o recredenciamento para poder publicar anúncios.</Aviso></div>
      )}

      <form onSubmit={enviar} className="space-y-6">
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">O que você está anunciando?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Categoria" value={f.categoria_id || ''} onChange={e => set('categoria_id', e.target.value)} required>
              <option value="">Escolha…</option>
              {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
            <Selecao rotulo="Tipo de anúncio" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="venda">Estou vendendo</option>
              <option value="servico">Ofereço um serviço</option>
              <option value="procura">Estou procurando</option>
              <option value="troca">Quero trocar</option>
            </Selecao>
          </div>
          <Entrada rotulo="Título" value={f.titulo || ''} onChange={e => set('titulo', e.target.value)} maxLength={120} required
            placeholder="Ex.: Trator Massey Ferguson 275 ano 1998" dica={`${(f.titulo || '').length}/120`} />
          <AreaTexto rotulo="Descrição" value={f.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={6} required
            placeholder="Estado de conservação, horas de uso, o que acompanha, forma de entrega…" />
          {ehMaquina && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Entrada rotulo="Marca" value={f.marca || ''} onChange={e => set('marca', e.target.value)} />
              <Entrada rotulo="Modelo" value={f.modelo || ''} onChange={e => set('modelo', e.target.value)} />
              <Entrada rotulo="Ano" inputMode="numeric" value={f.ano || ''} onChange={e => set('ano', soDigitos(e.target.value).slice(0, 4))} />
            </div>
          )}
          {f.tipo !== 'servico' && (
            <Selecao rotulo="Condição" value={f.condicao} onChange={e => set('condicao', e.target.value)}>
              <option value="usado">Usado</option>
              <option value="novo">Novo</option>
              <option value="nao_se_aplica">Não se aplica</option>
            </Selecao>
          )}
        </Cartao>

        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Fotos <span className="text-sm font-normal text-stone-500">({fotos.length}/{maxFotos})</span></h2>
          <p className="text-sm text-stone-500">Anúncios com boas fotos vendem mais rápido. A primeira foto é a capa.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {fotos.map((foto, i) => (
              <div key={foto.url} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                <img src={foto.url} alt="" className="size-full object-cover" />
                {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-siran-900 px-1.5 text-[10px] font-semibold text-white">CAPA</span>}
                <button type="button" onClick={() => removerFoto(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remover foto"><X className="size-4" /></button>
              </div>
            ))}
            {fotos.length < maxFotos && (
              <button type="button" onClick={() => inputFoto.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-sm text-siran-800 hover:border-siran-600 hover:bg-siran-50">
                <Camera className="size-6" /> Adicionar
              </button>
            )}
          </div>
          <input ref={inputFoto} type="file" accept="image/*" multiple hidden onChange={e => adicionarFotos(e.target.files)} />
        </Cartao>

        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Preço e contato</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao rotulo="Preço" value={f.preco_tipo} onChange={e => set('preco_tipo', e.target.value)}>
              <option value="fixo">Valor fixo</option>
              <option value="negociavel">Valor negociável</option>
              <option value="a_combinar">A combinar</option>
            </Selecao>
            {f.preco_tipo !== 'a_combinar' && (
              <Entrada rotulo="Valor (R$)" inputMode="decimal" value={f.preco || ''} onChange={e => set('preco', e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="0,00" required={f.tipo === 'venda'} />
            )}
            <Entrada rotulo="Cidade" value={f.cidade} onChange={e => set('cidade', e.target.value)} required />
            <Selecao rotulo="UF" value={f.uf} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
            <Entrada rotulo="WhatsApp para contato" inputMode="tel" value={f.contato_whatsapp} onChange={e => set('contato_whatsapp', mascaraTelefone(e.target.value))} />
            <Entrada rotulo="Telefone (opcional)" inputMode="tel" value={f.contato_telefone} onChange={e => set('contato_telefone', mascaraTelefone(e.target.value))} />
          </div>
        </Cartao>

        <p className="text-xs text-stone-500">
          Não são aceitos anúncios de armas, munições, defensivos sem receituário, animais sem documentação sanitária (GTA) ou itens de origem ilegal.
        </p>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" tamanho="lg" carregando={enviando} icone={<Send className="size-4" />} className="w-full sm:w-auto">
          {editando ? 'Salvar e enviar para aprovação' : 'Enviar para aprovação'}
        </Botao>
      </form>
    </div>
  )
}
