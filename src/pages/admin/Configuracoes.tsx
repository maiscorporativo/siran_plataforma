import { useEffect, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAdmin } from '../../lib/auth'
import { Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, useToast } from '../../components/ui'

export default function Configuracoes() {
  const { usuario } = useAdmin()
  const { dados, carregando } = useApi<Record<string, string>>('/admin/configuracoes')
  const [d, setD] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => { if (dados) setD(dados) }, [dados])
  if (usuario?.papel !== 'master') return <Aviso tom="amarelo">Apenas o usuário master altera as configurações.</Aviso>
  if (carregando && !dados) return <Carregando />

  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      setD(await api('/admin/configuracoes', { method: 'PUT', body: d }))
      toast('Configurações salvas.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="max-w-2xl space-y-6">
      <Cabecalho titulo="Configurações" />
      <Cartao className="space-y-4 p-5">
        <h2 className="font-semibold">Credenciamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada rotulo="Validade do credenciamento (meses)" inputMode="numeric" value={d.validade_meses || ''} onChange={e => set('validade_meses', e.target.value)}
            dica="Usado na aprovação da filiação e em cada recredenciamento." />
          <Entrada rotulo="Abrir recredenciamento (dias antes)" inputMode="numeric" value={d.aviso_recredenciamento_dias || ''} onChange={e => set('aviso_recredenciamento_dias', e.target.value)}
            dica="O associado é avisado e pode enviar a partir daí." />
        </div>
      </Cartao>
      <Cartao className="space-y-4 p-5">
        <h2 className="font-semibold">Classificados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada rotulo="Anúncio fica no ar por (dias)" inputMode="numeric" value={d.anuncio_validade_dias || ''} onChange={e => set('anuncio_validade_dias', e.target.value)} />
          <Entrada rotulo="Máximo de fotos por anúncio" inputMode="numeric" value={d.anuncio_max_fotos || ''} onChange={e => set('anuncio_max_fotos', e.target.value)} />
        </div>
      </Cartao>
      <Cartao className="space-y-4 p-5">
        <h2 className="font-semibold">Contato do sindicato</h2>
        <p className="text-sm text-stone-500">Exibido para associados na tela de entrada e no menu "Falar com o sindicato".</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada rotulo="WhatsApp (com DDI e DDD)" value={d.whatsapp_sindicato || ''} onChange={e => set('whatsapp_sindicato', e.target.value.replace(/\D/g, ''))} dica="Ex.: 5518999999999" />
          <Entrada rotulo="Telefone" value={d.telefone_sindicato || ''} onChange={e => set('telefone_sindicato', e.target.value)} />
          <Entrada rotulo="E-mail" className="sm:col-span-2" value={d.email_sindicato || ''} onChange={e => set('email_sindicato', e.target.value)} />
        </div>
      </Cartao>
      <Botao type="submit" carregando={salvando} icone={<Save className="size-4" />}>Salvar configurações</Botao>
    </form>
  )
}
