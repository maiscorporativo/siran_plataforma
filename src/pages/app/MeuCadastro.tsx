import { useEffect, useState, type FormEvent } from 'react'
import { FileText, Save, Trash2, Upload } from 'lucide-react'
import { abrirArquivo, api, formData } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAssociado } from '../../lib/auth'
import { data, mascaraDocumento, tamanhoArquivo } from '../../lib/format'
import { Aviso, Botao, Cabecalho, Cartao, Entrada, Marcador, useConfirmacao, useToast } from '../../components/ui'
import { CamposContato, CamposEndereco, CamposPropriedade, paraFormulario, soEditaveis, type Dados } from '../../components/CamposCadastro'
import { EnvioDocumentos, TIPOS_DOCUMENTO, anexarDocumentos, type DocumentoNovo } from '../../components/EnvioDocumentos'
import { FormTrocarSenha } from '../../components/TrocarSenha'
import type { Associado } from '../../lib/tipos'

type Doc = { id: number; tipo: string; nome_original: string; tamanho: number; created_at: string }

export default function MeuCadastro() {
  const { usuario, setUsuario } = useAssociado()
  const [dados, setDados] = useState<Dados>({})
  const [salvando, setSalvando] = useState(false)
  const [novos, setNovos] = useState<DocumentoNovo[]>([])
  const [enviandoDocs, setEnviandoDocs] = useState(false)
  const { dados: docs, recarregar } = useApi<{ documentos: Doc[] }>('/associado/documentos')
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  useEffect(() => { if (usuario) setDados(paraFormulario(usuario as unknown as Record<string, unknown>)) }, [usuario])
  if (!usuario) return null

  const pendente = usuario.status === 'pendente'
  const set = (k: string, v: string) => setDados(d => ({ ...d, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const r = await api<{ associado: Associado }>('/associado/perfil', { method: 'PUT', body: { ...soEditaveis(dados), ...(pendente ? { nome: dados.nome } : {}) } })
      setUsuario(r.associado)
      toast('Dados atualizados.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarPreferencia(campo: 'aceita_email' | 'aceita_whatsapp', valor: boolean) {
    try {
      const r = await api<{ associado: Associado }>('/associado/perfil', { method: 'PUT', body: { [campo]: valor } })
      setUsuario(r.associado)
      toast('Preferência salva.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    }
  }

  async function enviarDocs() {
    setEnviandoDocs(true)
    try {
      const f = formData({})
      anexarDocumentos(f, novos)
      await api('/associado/documentos', { method: 'POST', form: f })
      setNovos([])
      recarregar()
      toast('Documentos enviados.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviandoDocs(false)
    }
  }

  async function removerDoc(d: Doc) {
    if (!(await confirmar('Remover documento', `Remover "${d.nome_original}"?`, 'Remover', true))) return
    try {
      await api(`/associado/documentos/${d.id}`, { method: 'DELETE' })
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Cabecalho titulo="Meu cadastro" descricao="Mantenha seu contato e os dados da propriedade sempre atualizados." />

      <form onSubmit={salvar} className="space-y-6">
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Identificação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo={usuario.tipo_pessoa === 'PJ' ? 'Razão social' : 'Nome'} value={dados.nome || ''} onChange={e => set('nome', e.target.value)} disabled={!pendente}
              dica={!pendente ? 'Para alterar o nome, fale com o sindicato.' : undefined} />
            <Entrada rotulo={usuario.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'} value={mascaraDocumento(usuario.cpf_cnpj)} disabled />
            <Entrada rotulo={usuario.tipo_pessoa === 'PJ' ? 'Inscrição estadual' : 'RG'} value={dados.rg_ie || ''} onChange={e => set('rg_ie', e.target.value)} />
            {usuario.tipo_pessoa === 'PF' && <Entrada rotulo="Data de nascimento" type="date" value={dados.data_nascimento || ''} onChange={e => set('data_nascimento', e.target.value)} />}
          </div>
          {usuario.matricula && <p className="text-sm text-stone-500">Matrícula {usuario.matricula} · associado desde {data(usuario.data_filiacao)}</p>}
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Contato e endereço</h2>
          <CamposContato dados={dados} set={set} />
          <CamposEndereco dados={dados} set={set} />
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Propriedade rural</h2>
          <CamposPropriedade dados={dados} set={set} />
        </Cartao>
        <Botao type="submit" carregando={salvando} icone={<Save className="size-4" />}>Salvar alterações</Botao>
      </form>

      <Cartao className="space-y-4 p-5">
        <h2 className="font-semibold">Documentos</h2>
        {!pendente && <p className="text-sm text-stone-500">Documentos enviados ficam disponíveis apenas para você e a equipe do SIRAN.</p>}
        {docs?.documentos.length ? (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {docs.documentos.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-5 shrink-0 text-stone-400" />
                <button onClick={() => abrirArquivo(`/associado/documentos/${d.id}/arquivo`, d.nome_original).catch(e => toast(e.message, 'erro'))} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-siran-800 hover:underline">{TIPOS_DOCUMENTO[d.tipo] || d.tipo}</p>
                  <p className="truncate text-xs text-stone-500">{d.nome_original} · {tamanhoArquivo(d.tamanho)} · {data(d.created_at)}</p>
                </button>
                {pendente && <button onClick={() => removerDoc(d)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover"><Trash2 className="size-4" /></button>}
              </li>
            ))}
          </ul>
        ) : <Aviso tom="amarelo">Nenhum documento enviado ainda.</Aviso>}
        <EnvioDocumentos lista={novos} onChange={setNovos} />
        {novos.length > 0 && <Botao onClick={enviarDocs} carregando={enviandoDocs} icone={<Upload className="size-4" />}>Enviar {novos.length} documento(s)</Botao>}
      </Cartao>

      <Cartao className="space-y-2 p-5">
        <h2 className="font-semibold">Avisos do sindicato</h2>
        <p className="text-sm text-stone-500">Boleto disponível, vencimento do credenciamento, anúncio aprovado e novos comunicados.</p>
        <Marcador rotulo="Receber avisos pelo WhatsApp" checked={!!usuario.aceita_whatsapp} onChange={v => salvarPreferencia('aceita_whatsapp', v)} />
        <Marcador rotulo="Receber avisos por e-mail" checked={!!usuario.aceita_email} onChange={v => salvarPreferencia('aceita_email', v)} />
        <p className="text-xs text-stone-400">Links de recuperação de senha e respostas sobre sua filiação são enviados sempre.</p>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-4 font-semibold">Trocar senha</h2>
        <div className="max-w-sm"><FormTrocarSenha area="associado" onConcluir={() => {}} /></div>
      </Cartao>
      {elemento}
    </div>
  )
}
