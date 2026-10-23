import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { Botao, Cabecalho, Carregando, Cartao, Erro, cx, useConfirmacao, useToast } from '../../components/ui'

type Cat = { id: number; nome: string; icone: string | null; ordem: number; ativo: number; uso: number }

export default function Categorias() {
  const [escopo, setEscopo] = useState<'classificado' | 'conveniado'>('classificado')
  const { dados, erro, carregando, recarregar } = useApi<Cat[]>(`/admin/categorias?escopo=${escopo}`)
  const [nova, setNova] = useState('')
  const toast = useToast()

  async function criar() {
    if (!nova.trim()) return
    try {
      await api('/admin/categorias', { method: 'POST', body: { escopo, nome: nova } })
      setNova('')
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Categorias" descricao="Organize os classificados e o guia de conveniados." />
      <div className="mb-5 flex gap-2">
        {([['classificado', 'Classificados'], ['conveniado', 'Conveniados']] as const).map(([k, v]) => (
          <button key={k} onClick={() => setEscopo(k)} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', escopo === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{v}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : (
        <Cartao className="divide-y divide-stone-100">
          {dados?.map(c => <Linha key={`${escopo}-${c.id}`} c={c} onAlterado={recarregar} />)}
          <div className="flex gap-2 p-3">
            <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => e.key === 'Enter' && criar()} placeholder="Nova categoria" className="campo" aria-label="Nova categoria" />
            <Botao onClick={criar} icone={<Plus className="size-4" />}>Adicionar</Botao>
          </div>
        </Cartao>
      )}
    </div>
  )
}

function Linha({ c, onAlterado }: { c: Cat; onAlterado: () => void }) {
  const [nome, setNome] = useState(c.nome)
  const [ordem, setOrdem] = useState(String(c.ordem))
  const [ativo, setAtivo] = useState(!!c.ativo)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()
  const alterado = nome !== c.nome || ordem !== String(c.ordem) || ativo !== !!c.ativo

  async function salvar() {
    try {
      await api(`/admin/categorias/${c.id}`, { method: 'PUT', body: { nome, ordem, ativo, icone: c.icone } })
      toast('Categoria salva.')
      onAlterado()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  async function excluir() {
    if (!(await confirmar('Excluir categoria', `Excluir "${c.nome}"?`, 'Excluir', true))) return
    try {
      await api(`/admin/categorias/${c.id}`, { method: 'DELETE' })
      onAlterado()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      <input value={ordem} onChange={e => setOrdem(e.target.value.replace(/\D/g, ''))} className="campo !w-14 text-center" aria-label="Ordem" />
      <input value={nome} onChange={e => setNome(e.target.value)} className="campo min-w-40 flex-1" aria-label="Nome" />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="size-4 accent-siran-700" /> Ativa</label>
      <span className="w-20 text-right text-xs text-stone-500">{c.uso} em uso</span>
      {alterado && <Botao tamanho="sm" onClick={salvar} icone={<Save className="size-4" />}>Salvar</Botao>}
      {c.uso === 0 && <button onClick={excluir} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir"><Trash2 className="size-4" /></button>}
      {elemento}
    </div>
  )
}
