import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, Send } from 'lucide-react'
import { api, formData } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAssociado } from '../../lib/auth'
import { data, dataHora } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Erro, Marcador, useToast } from '../../components/ui'
import { SituacaoAssociado, StatusRecredenciamento } from '../../components/Status'
import { CamposContato, CamposEndereco, CamposPropriedade, paraFormulario, soEditaveis, type Dados } from '../../components/CamposCadastro'
import { EnvioDocumentos, anexarDocumentos, type DocumentoNovo } from '../../components/EnvioDocumentos'

type Pedido = { id: number; status: string; observacao_associado: string | null; resposta: string | null; validade_anterior: string | null; validade_nova: string | null; created_at: string; analisado_em: string | null }
type Info = { situacao: string; validade_ate: string | null; janela_abre_em: string | null; pode_enviar: boolean; em_andamento: Pedido | null; historico: Pedido[] }

export default function Recredenciamento() {
  const { usuario, atualizar } = useAssociado()
  const { dados: info, erro, carregando, recarregar } = useApi<Info>('/associado/recredenciamento')
  const [dados, setDados] = useState<Dados>({})
  const [documentos, setDocumentos] = useState<DocumentoNovo[]>([])
  const [observacao, setObservacao] = useState('')
  const [declaracao, setDeclaracao] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()

  useEffect(() => { if (usuario) setDados(paraFormulario(usuario as unknown as Record<string, unknown>)) }, [usuario])
  const set = (k: string, v: string) => setDados(d => ({ ...d, [k]: v }))

  if (carregando && !info) return <Carregando />
  if (erro || !info) return <Erro mensagem={erro || ''} tentar={recarregar} />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErroEnvio(null)
    if (!declaracao) return setErroEnvio('Confirme a declaração para enviar.')
    setEnviando(true)
    try {
      const f = formData({ dados: JSON.stringify(soEditaveis(dados)), observacao, declaracao: true })
      anexarDocumentos(f, documentos)
      await api('/associado/recredenciamento', { method: 'POST', form: f })
      toast('Recredenciamento enviado! Avisaremos quando for analisado.')
      setDocumentos([]); setObservacao(''); setDeclaracao(false)
      recarregar(); atualizar()
    } catch (err) {
      setErroEnvio((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const pendencia = info.em_andamento?.status === 'pendencia'

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Recredenciamento" descricao="Confirme seus dados e envie os documentos atualizados para renovar o credenciamento." />

      <Cartao className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <div className="rounded-xl bg-siran-100 p-3 text-siran-900"><CalendarClock className="size-6" /></div>
        <div className="flex-1">
          <p className="text-sm text-stone-500">Credenciamento válido até</p>
          <p className="text-xl font-semibold">{data(info.validade_ate)}</p>
        </div>
        <SituacaoAssociado situacao={info.situacao} />
      </Cartao>

      {info.em_andamento?.status === 'enviado' && (
        <Aviso tom="azul" titulo="Recredenciamento em análise">
          Enviado em {dataHora(info.em_andamento.created_at)}. A equipe do SIRAN vai conferir e você verá o resultado aqui.
        </Aviso>
      )}

      {!info.pode_enviar && !info.em_andamento && (
        <Aviso tom="verde" titulo="Você está em dia">
          O recredenciamento abre em {data(info.janela_abre_em)}. Até lá, mantenha seus dados atualizados em "Meu cadastro".
        </Aviso>
      )}

      {info.pode_enviar && (
        <form onSubmit={enviar} className="space-y-6">
          {pendencia && (
            <Aviso tom="vermelho" titulo="O sindicato apontou uma pendência">{info.em_andamento!.resposta}</Aviso>
          )}
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">1. Confira seu contato e endereço</h2>
            <CamposContato dados={dados} set={set} />
            <CamposEndereco dados={dados} set={set} />
          </Cartao>
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">2. Confira os dados da propriedade</h2>
            <CamposPropriedade dados={dados} set={set} />
          </Cartao>
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">3. Envie os documentos atualizados</h2>
            <p className="text-sm text-stone-500">Comprovante de endereço recente e documentos da propriedade (CCIR, CAR ou inscrição de produtor) que tenham mudado.</p>
            <EnvioDocumentos lista={documentos} onChange={setDocumentos} sugestao="comprovante_endereco" />
            <AreaTexto rotulo="Observações para o sindicato (opcional)" value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} />
          </Cartao>
          <Marcador checked={declaracao} onChange={setDeclaracao} rotulo="Declaro que as informações acima são verdadeiras e estão atualizadas." />
          {erroEnvio && <Aviso tom="vermelho">{erroEnvio}</Aviso>}
          <Botao type="submit" tamanho="lg" carregando={enviando} icone={<Send className="size-4" />}>
            {pendencia ? 'Reenviar com as correções' : 'Enviar recredenciamento'}
          </Botao>
        </form>
      )}

      {info.historico.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Histórico</h2>
          <Cartao className="divide-y divide-stone-100">
            {info.historico.map(h => (
              <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium">Enviado em {dataHora(h.created_at)}</p>
                  {h.status === 'aprovado' && <p className="flex items-center gap-1 text-siran-700"><CheckCircle2 className="size-4" /> Validade renovada até {data(h.validade_nova)}</p>}
                  {h.resposta && h.status !== 'aprovado' && <p className="text-stone-600">{h.resposta}</p>}
                </div>
                <StatusRecredenciamento status={h.status} />
              </div>
            ))}
          </Cartao>
        </section>
      )}
    </div>
  )
}
