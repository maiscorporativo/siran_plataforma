import { useState } from 'react'
import { Copy, FileDown, QrCode, Receipt } from 'lucide-react'
import { abrirArquivo } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { competencia, data, moeda } from '../../lib/format'
import { Aviso, Botao, Cabecalho, Carregando, Cartao, Erro, Vazio, cx, useCopiar, useToast } from '../../components/ui'
import { StatusBoleto } from '../../components/Status'
import type { Boleto } from '../../lib/tipos'

/* Linha digitável em blocos para facilitar a conferência */
const formatarLinha = (l: string) => l.replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d)(\d{14})/, '$1.$2 $3.$4 $5.$6 $7 $8')

export default function Boletos() {
  const { dados, erro, carregando, recarregar } = useApi<Boleto[]>('/boletos')
  const [historico, setHistorico] = useState(false)
  const copiar = useCopiar()
  const toast = useToast()

  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro || ''} tentar={recarregar} />

  const abertos = dados.filter(b => b.status === 'aberto')
  const pagos = dados.filter(b => b.status === 'pago')
  const baixar = (b: Boleto) => abrirArquivo(`/boletos/${b.id}/arquivo`, `boleto-${b.competencia}.pdf`).catch(e => toast(e.message, 'erro'))

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Boletos" descricao="Mensalidades do sindicato. Pague pelo app do banco usando a linha digitável, o Pix ou o PDF." />

      {abertos.length === 0 ? (
        <Aviso tom="verde" titulo="Você está em dia!">Nenhuma mensalidade em aberto no momento.</Aviso>
      ) : (
        <div className="space-y-4">
          {abertos.map(b => (
            <Cartao key={b.id} className={cx('p-5', b.vencido && 'border-red-200')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-stone-500">{b.descricao || `Mensalidade ${competencia(b.competencia)}`}</p>
                  <p className="text-2xl font-semibold text-stone-900">{moeda(b.valor)}</p>
                  <p className={cx('text-sm', b.vencido ? 'font-medium text-red-700' : 'text-stone-600')}>Vencimento {data(b.vencimento)}</p>
                </div>
                <StatusBoleto status={b.status} vencido={b.vencido} />
              </div>
              {b.vencido ? <p className="mt-3 text-xs text-stone-500">Boleto vencido: o banco pode cobrar multa e juros. Em caso de dúvida, fale com o sindicato.</p> : null}

              {b.linha_digitavel && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Linha digitável</p>
                  <p className="mt-1 break-all rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm">{formatarLinha(b.linha_digitavel)}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {b.linha_digitavel && <Botao onClick={() => copiar(b.linha_digitavel!, 'Linha digitável copiada!')} icone={<Copy className="size-4" />}>Copiar código</Botao>}
                {b.pix_copia_cola && <Botao variante="claro" onClick={() => copiar(b.pix_copia_cola!, 'Pix copia e cola copiado!')} icone={<QrCode className="size-4" />}>Copiar Pix</Botao>}
                {!!b.tem_arquivo && <Botao variante="secundario" onClick={() => baixar(b)} icone={<FileDown className="size-4" />}>Abrir PDF</Botao>}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <div className="mt-8">
        <button onClick={() => setHistorico(!historico)} className="font-medium text-siran-700 hover:underline">
          {historico ? 'Ocultar' : 'Ver'} histórico de pagamentos ({pagos.length})
        </button>
        {historico && (pagos.length === 0 ? (
          <div className="mt-3"><Vazio icone={<Receipt />} titulo="Nenhum pagamento registrado ainda" /></div>
        ) : (
          <Cartao className="mt-3 divide-y divide-stone-100">
            {pagos.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{competencia(b.competencia)}</p>
                  <p className="text-stone-500">Pago em {data(b.pago_em)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{moeda(b.valor_pago ?? b.valor)}</p>
                  <StatusBoleto status={b.status} vencido={0} />
                </div>
              </div>
            ))}
          </Cartao>
        ))}
      </div>
    </div>
  )
}
