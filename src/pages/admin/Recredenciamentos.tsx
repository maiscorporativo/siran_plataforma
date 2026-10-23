import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FileText, RefreshCw, XCircle, AlertTriangle } from 'lucide-react'
import { abrirArquivo, api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data, dataHora } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Erro, Modal, Vazio, cx, useToast } from '../../components/ui'
import { StatusRecredenciamento } from '../../components/Status'
import { TIPOS_DOCUMENTO } from '../../components/EnvioDocumentos'

type Item = { id: number; status: string; created_at: string; analisado_em: string | null; associado_id: number; nome: string; matricula: string; cidade: string; validade_ate: string; documentos: number; validade_nova: string | null }
type Detalhe = {
  recredenciamento: { id: number; status: string; observacao_associado: string | null; resposta: string | null; created_at: string }
  associado: { id: number; nome: string; matricula: string; validade_ate: string }
  alteracoes: { campo: string; atual: unknown; novo: unknown }[]
  documentos: { id: number; tipo: string; nome_original: string }[]
}

const ROTULOS: Record<string, string> = {
  rg_ie: 'RG / IE', email: 'E-mail', telefone: 'Telefone', whatsapp: 'WhatsApp', cep: 'CEP', logradouro: 'Endereço', numero: 'Número',
  complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade', uf: 'UF', propriedade_nome: 'Propriedade', propriedade_municipio: 'Município da propriedade',
  propriedade_area_ha: 'Área (ha)', atividades: 'Atividades', inscricao_produtor: 'Inscrição de produtor', car: 'CAR', ccir: 'CCIR', data_nascimento: 'Nascimento',
}

const ABAS = [['enviado', 'Aguardando análise'], ['pendencia', 'Com pendência'], ['aprovado', 'Aprovados'], ['reprovado', 'Reprovados']]

export default function Recredenciamentos() {
  const [aba, setAba] = useState('enviado')
  const [aberto, setAberto] = useState<number | null>(null)
  const { dados, erro, carregando, recarregar } = useApi<Item[]>(`/admin/recredenciamentos?status=${aba}`)

  return (
    <div>
      <Cabecalho titulo="Recredenciamentos" descricao="Confira os dados e documentos enviados e renove a validade do credenciamento." />
      <div className="mb-5 flex flex-wrap gap-2">
        {ABAS.map(([k, v]) => (
          <button key={k} onClick={() => setAba(k)} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', aba === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{v}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.length ? (
        <Vazio icone={<RefreshCw />} titulo="Nada por aqui" />
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {dados.map(r => (
            <button key={r.id} onClick={() => setAberto(r.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{r.nome}</p>
                <p className="text-sm text-stone-500">Matrícula {r.matricula} · {r.cidade} · validade atual {data(r.validade_ate)}</p>
              </div>
              <div className="text-right text-sm text-stone-500">
                <p>Enviado {dataHora(r.created_at)}</p>
                <p>{r.documentos} documento(s)</p>
              </div>
              <StatusRecredenciamento status={r.status} />
            </button>
          ))}
        </Cartao>
      )}
      {aberto && <Analise id={aberto} onFechar={() => setAberto(null)} onConcluir={() => { setAberto(null); recarregar() }} />}
    </div>
  )
}

function Analise({ id, onFechar, onConcluir }: { id: number; onFechar: () => void; onConcluir: () => void }) {
  const { dados: d, carregando } = useApi<Detalhe>(`/admin/recredenciamentos/${id}`)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const toast = useToast()

  async function decidir(decisao: string) {
    if (decisao !== 'aprovado' && !resposta.trim()) return toast('Escreva para o associado o que precisa ser corrigido.', 'erro')
    setEnviando(decisao)
    try {
      const r = await api<{ validade_nova: string | null }>(`/admin/recredenciamentos/${id}/decisao`, { method: 'POST', body: { decisao, resposta } })
      toast(decisao === 'aprovado' ? `Aprovado! Nova validade: ${data(r.validade_nova)}` : 'Resposta enviada ao associado.')
      onConcluir()
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviando(null)
    }
  }

  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? <span className="text-stone-400">vazio</span> : String(v))
  const podeDecidir = d?.recredenciamento.status === 'enviado'

  return (
    <Modal aberto titulo="Análise de recredenciamento" onFechar={onFechar} largura="max-w-2xl"
      rodape={podeDecidir ? <>
        <Botao variante="secundario" carregando={enviando === 'reprovado'} icone={<XCircle className="size-4" />} onClick={() => decidir('reprovado')}>Reprovar</Botao>
        <Botao variante="secundario" carregando={enviando === 'pendencia'} icone={<AlertTriangle className="size-4" />} onClick={() => decidir('pendencia')}>Apontar pendência</Botao>
        <Botao carregando={enviando === 'aprovado'} icone={<CheckCircle2 className="size-4" />} onClick={() => decidir('aprovado')}>Aprovar e renovar</Botao>
      </> : undefined}>
      {carregando || !d ? <Carregando /> : (
        <div className="space-y-5">
          <div>
            <Link to={`/admin/associados/${d.associado.id}`} className="text-lg font-semibold text-siran-900 hover:underline">{d.associado.nome}</Link>
            <p className="text-sm text-stone-500">Matrícula {d.associado.matricula} · validade atual {data(d.associado.validade_ate)} · enviado {dataHora(d.recredenciamento.created_at)}</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Dados alterados</h3>
            {d.alteracoes.length === 0 ? <p className="text-sm text-stone-500">O associado confirmou os dados sem alterações.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-stone-500"><tr><th className="py-1">Campo</th><th>Atual</th><th>Novo</th></tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {d.alteracoes.map(x => (
                    <tr key={x.campo}><td className="py-1.5 pr-2 text-stone-600">{ROTULOS[x.campo] || x.campo}</td><td className="pr-2 text-stone-500 line-through">{fmt(x.atual)}</td><td className="font-medium text-siran-900">{fmt(x.novo)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Documentos enviados</h3>
            {d.documentos.length === 0 ? <p className="text-sm text-stone-500">Nenhum documento anexado.</p> : (
              <ul className="space-y-1">
                {d.documentos.map(doc => (
                  <li key={doc.id}>
                    <button onClick={() => abrirArquivo(`/admin/associados/documentos/${doc.id}/arquivo`, doc.nome_original).catch(e => toast(e.message, 'erro'))}
                      className="inline-flex items-center gap-2 text-sm font-medium text-siran-800 hover:underline">
                      <FileText className="size-4" /> {TIPOS_DOCUMENTO[doc.tipo] || doc.tipo} — {doc.nome_original}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {d.recredenciamento.observacao_associado && <Aviso tom="azul" titulo="Observação do associado">{d.recredenciamento.observacao_associado}</Aviso>}
          {podeDecidir ? (
            <AreaTexto rotulo="Mensagem ao associado" value={resposta} onChange={e => setResposta(e.target.value)} rows={3}
              dica="Obrigatória para pendência ou reprovação. Opcional na aprovação." />
          ) : d.recredenciamento.resposta && <Aviso tom="amarelo" titulo="Resposta enviada">{d.recredenciamento.resposta}</Aviso>}
        </div>
      )}
    </Modal>
  )
}
