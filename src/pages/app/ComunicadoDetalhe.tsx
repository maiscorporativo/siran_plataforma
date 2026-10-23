import { useParams } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import { abrirArquivo } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data } from '../../lib/format'
import { Botao, Cabecalho, Carregando, Cartao, Erro, useToast } from '../../components/ui'
import { SeloOrigem } from '../../components/Status'
import { TIPO_COMUNICADO, type Comunicado } from '../../lib/tipos'

export default function ComunicadoDetalhe() {
  const { id } = useParams()
  const { dados: c, erro, carregando, recarregar } = useApi<Comunicado>(`/comunicados/${id}`)
  const toast = useToast()

  if (carregando && !c) return <Carregando />
  if (erro || !c) return <><Cabecalho titulo="Comunicado" voltar="/app/comunicados" /><Erro mensagem={erro || ''} tentar={recarregar} /></>

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo={c.titulo} voltar="/app/comunicados" />
      <Cartao className="p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          <SeloOrigem origem={c.origem} />
          <span>{TIPO_COMUNICADO[c.tipo]}</span>
          {c.numero && <span>· {c.numero}</span>}
          <span>· {data(c.data_publicacao)}</span>
        </div>
        {c.resumo && <p className="mt-4 text-[15px] font-medium text-stone-800">{c.resumo}</p>}
        {c.conteudo && <div className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-stone-700">{c.conteudo}</div>}
        {!!c.tem_arquivo && (
          <div className="mt-6 border-t border-stone-100 pt-5">
            <Botao onClick={() => abrirArquivo(`/comunicados/${c.id}/arquivo`, c.arquivo_nome || undefined).catch(e => toast(e.message, 'erro'))}
              icone={<FileDown className="size-4" />}>
              Abrir documento oficial (PDF)
            </Botao>
            {c.arquivo_nome && <p className="mt-2 text-xs text-stone-500">{c.arquivo_nome}</p>}
          </div>
        )}
      </Cartao>
    </div>
  )
}
