import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, FileStack, FileText, FileUp, MoreHorizontal, Plus, Receipt, Search } from 'lucide-react'
import { abrirArquivo, api, formData, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { competencia, data, mascaraDocumento, moeda } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Marcador, Modal, Paginacao, Vazio, useConfirmacao, useToast } from '../../components/ui'
import { StatusBoleto } from '../../components/Status'
import type { Associado, Boleto, Paginado } from '../../lib/tipos'

type Resposta = Paginado<Boleto> & {
  totais: { abertos: number; pagos: number; vencidos: number; valor_recebido: number; valor_aberto: number }
  competencias: string[]
}

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const mesAtual = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }

export default function AdmBoletos() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const [modal, setModal] = useState<'individual' | 'lote' | 'baixas' | null>(null)
  const [acoes, setAcoes] = useState<Boleto | null>(null)
  const f = (k: string) => params.get(k) || ''
  const { dados, erro, carregando, recarregar } = useApi<Resposta>(`/admin/boletos${qs({
    q: f('q'), competencia: f('competencia'), status: f('status'), associado_id: f('associado_id'), pagina: f('pagina'),
  })}`)

  const mudar = (m: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(m)) v ? p.set(k, v) : p.delete(k)
    if (!('pagina' in m)) p.delete('pagina')
    setParams(p)
  }
  const fechar = () => { setModal(null); recarregar() }

  return (
    <div>
      <Cabecalho titulo="Boletos" descricao="Mensalidades geradas no banco e disponibilizadas para os associados."
        acoes={<>
          <Botao variante="secundario" icone={<CheckCircle2 className="size-4" />} onClick={() => setModal('baixas')}>Baixa por planilha</Botao>
          <Botao variante="secundario" icone={<FileStack className="size-4" />} onClick={() => setModal('lote')}>Enviar lote de PDFs</Botao>
          <Botao icone={<Plus className="size-4" />} onClick={() => setModal('individual')}>Lançar boleto</Botao>
        </>} />

      {dados && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Em aberto', dados.totais.abertos, moeda(dados.totais.valor_aberto)],
            ['Vencidos', dados.totais.vencidos, null],
            ['Pagos', dados.totais.pagos, moeda(dados.totais.valor_recebido)],
            ['Total no filtro', dados.total, null],
          ].map(([r, n, v]) => (
            <Cartao key={String(r)} className="p-4">
              <p className="text-sm text-stone-500">{r}</p>
              <p className="text-2xl font-semibold">{n || 0}</p>
              {v && <p className="text-sm text-stone-600">{v}</p>}
            </Cartao>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Associado, CPF ou matrícula" className="campo !pl-10" aria-label="Buscar" />
        </form>
        <select value={f('competencia')} onChange={e => mudar({ competencia: e.target.value })} className="campo" aria-label="Competência">
          <option value="">Todas as competências</option>
          {dados?.competencias.map(c => <option key={c} value={c}>{competencia(c)}</option>)}
        </select>
        <select value={f('status')} onChange={e => mudar({ status: e.target.value })} className="campo" aria-label="Situação">
          <option value="">Qualquer situação</option>
          <option value="aberto">Em aberto</option>
          <option value="vencido">Vencidos</option>
          <option value="pago">Pagos</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>
      {f('associado_id') && <button onClick={() => mudar({ associado_id: '' })} className="mt-2 text-sm text-siran-700 hover:underline">Mostrando um associado · ver todos</button>}

      <div className="mt-5">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<Receipt />} titulo="Nenhum boleto encontrado">Envie os PDFs gerados no banco em "Enviar lote de PDFs".</Vazio>
        ) : (
          <>
            <Cartao className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="px-4 py-3 font-medium">Associado</th><th className="px-4 py-3 font-medium">Comp.</th><th className="px-4 py-3 font-medium">Vencimento</th><th className="px-4 py-3 font-medium">Valor</th><th className="px-4 py-3 font-medium">Situação</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dados.itens.map(b => (
                    <tr key={b.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3"><Link to={`/admin/associados/${b.associado_id}`} className="font-medium text-siran-900 hover:underline">{b.nome}</Link><p className="text-xs text-stone-500">{b.matricula ? `Mat. ${b.matricula} · ` : ''}{mascaraDocumento(b.cpf_cnpj || '')}</p></td>
                      <td className="px-4 py-3">{competencia(b.competencia)}</td>
                      <td className="px-4 py-3">{data(b.vencimento)}</td>
                      <td className="px-4 py-3">{moeda(b.valor)}</td>
                      <td className="px-4 py-3"><StatusBoleto status={b.status} vencido={b.vencido} />{b.pago_em && <p className="text-xs text-stone-500">{data(b.pago_em)}</p>}</td>
                      <td className="px-2 py-3 text-right"><button onClick={() => setAcoes(b)} className="rounded-lg p-2 hover:bg-stone-100" aria-label="Ações"><MoreHorizontal className="size-5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
            <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => mudar({ pagina: String(p) })} />
          </>
        )}
      </div>

      {modal === 'individual' && <LancarBoleto onFechar={fechar} />}
      {modal === 'lote' && <Lote onFechar={fechar} />}
      {modal === 'baixas' && <Baixas onFechar={fechar} />}
      {acoes && <AcoesBoleto b={acoes} onFechar={() => setAcoes(null)} onAlterado={() => { setAcoes(null); recarregar() }} />}
    </div>
  )
}

function LancarBoleto({ onFechar }: { onFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const [assoc, setAssoc] = useState<Associado | null>(null)
  const { dados: resultados } = useApi<Paginado<Associado>>(busca.length >= 3 && !assoc ? `/admin/associados${qs({ q: busca, por_pagina: 6 })}` : null)
  const [d, setD] = useState({ competencia: mesAtual(), vencimento: '', valor: '', linha_digitavel: '', pix_copia_cola: '' })
  const [avisar, setAvisar] = useState(true)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!assoc) return setErro('Escolha o associado.')
    setErro(null)
    setEnviando(true)
    try {
      await api('/admin/boletos', { method: 'POST', form: formData({ ...d, associado_id: String(assoc.id), arquivo, avisar }) })
      toast('Boleto lançado.')
      onFechar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo="Lançar boleto" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {assoc ? (
          <div className="flex items-center justify-between rounded-lg bg-siran-50 px-3 py-2">
            <div><p className="font-medium">{assoc.nome}</p><p className="text-xs text-stone-500">Matrícula {assoc.matricula}</p></div>
            <button type="button" onClick={() => setAssoc(null)} className="text-sm text-siran-700 hover:underline">Trocar</button>
          </div>
        ) : (
          <div>
            <Entrada rotulo="Associado" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Digite nome, CPF ou matrícula" autoFocus />
            {resultados?.itens.map(a => (
              <button key={a.id} type="button" onClick={() => setAssoc(a)} className="block w-full border-b border-stone-100 px-2 py-2 text-left text-sm hover:bg-stone-50">
                {a.nome} <span className="text-stone-500">· {a.matricula || 'sem matrícula'}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Entrada rotulo="Competência" value={d.competencia} onChange={e => set('competencia', e.target.value)} placeholder="MM/AAAA" required />
          <Entrada rotulo="Vencimento" type="date" value={d.vencimento} onChange={e => set('vencimento', e.target.value)} required />
          <Entrada rotulo="Valor (R$)" inputMode="decimal" value={d.valor} onChange={e => set('valor', e.target.value)} required />
        </div>
        <Entrada rotulo="Linha digitável" value={d.linha_digitavel} onChange={e => set('linha_digitavel', e.target.value)} />
        <AreaTexto rotulo="Pix copia e cola (opcional)" value={d.pix_copia_cola} onChange={e => set('pix_copia_cola', e.target.value)} rows={2} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">PDF do boleto</p>
          <input type="file" accept="application/pdf" onChange={e => setArquivo(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-siran-100 file:px-4 file:py-2 file:font-medium file:text-siran-900" />
        </div>
        <Marcador rotulo="Avisar o associado por WhatsApp e e-mail" checked={avisar} onChange={setAvisar} />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" carregando={enviando} className="w-full">Lançar</Botao>
      </form>
    </Modal>
  )
}

type ResultadoLote = { criados: { arquivo: string; nome: string }[]; substituidos: { arquivo: string; nome: string }[]; nao_identificados: string[]; ignorados: { arquivo: string; nome: string; motivo: string }[] }

function Lote({ onFechar }: { onFechar: () => void }) {
  const [d, setD] = useState({ competencia: mesAtual(), vencimento: '', valor: '', descricao: '' })
  const [avisar, setAvisar] = useState(true)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [resultado, setResultado] = useState<ResultadoLote | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!arquivos.length) return setErro('Selecione os PDFs.')
    setErro(null)
    setEnviando(true)
    try {
      const form = formData({ ...d, avisar })
      arquivos.forEach(a => form.append('arquivos', a))
      setResultado(await api('/admin/boletos/lote', { method: 'POST', form }))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo="Enviar lote de boletos" onFechar={onFechar} largura="max-w-xl">
      {resultado ? (
        <div className="space-y-3 text-sm">
          <Aviso tom="verde" titulo={`${resultado.criados.length} boleto(s) criado(s)${resultado.substituidos.length ? `, ${resultado.substituidos.length} substituído(s)` : ''}`} />
          {resultado.nao_identificados.length > 0 && (
            <Aviso tom="vermelho" titulo={`${resultado.nao_identificados.length} arquivo(s) sem associado identificado`}>
              <p>Renomeie com o CPF/CNPJ ou a matrícula e envie de novo:</p>
              <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto">{resultado.nao_identificados.map(n => <li key={n}>{n}</li>)}</ul>
            </Aviso>
          )}
          {resultado.ignorados.length > 0 && (
            <Aviso tom="amarelo" titulo="Ignorados">
              <ul className="list-inside list-disc">{resultado.ignorados.map(i => <li key={i.arquivo}>{i.nome}: {i.motivo}</li>)}</ul>
            </Aviso>
          )}
          <Botao onClick={onFechar}>Concluir</Botao>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Aviso tom="azul" titulo="Como funciona">
            Gere os boletos no sistema do banco, salve um PDF por associado com o <b>CPF/CNPJ</b> ou a <b>matrícula</b> no nome do arquivo
            (ex.: <code>12345678909.pdf</code> ou <code>mat-0153.pdf</code>) e envie todos de uma vez.
          </Aviso>
          <div className="grid gap-4 sm:grid-cols-3">
            <Entrada rotulo="Competência" value={d.competencia} onChange={e => set('competencia', e.target.value)} placeholder="MM/AAAA" required />
            <Entrada rotulo="Vencimento" type="date" value={d.vencimento} onChange={e => set('vencimento', e.target.value)} required />
            <Entrada rotulo="Valor (R$)" inputMode="decimal" value={d.valor} onChange={e => set('valor', e.target.value)} required />
          </div>
          <Entrada rotulo="Descrição (opcional)" value={d.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Mensalidade associativa" />
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-4 py-8 text-center hover:border-siran-600 hover:bg-siran-50">
            <FileUp className="size-8 text-siran-700" />
            <span className="font-medium text-siran-900">{arquivos.length ? `${arquivos.length} PDF(s) selecionado(s)` : 'Selecionar PDFs dos boletos'}</span>
            <span className="text-xs text-stone-500">Até 500 arquivos por envio</span>
            <input type="file" accept="application/pdf" multiple hidden onChange={e => setArquivos(Array.from(e.target.files || []))} />
          </label>
          <Marcador rotulo="Avisar cada associado por WhatsApp e e-mail" descricao="Os avisos saem um de cada vez, com intervalo, para proteger o número do sindicato." checked={avisar} onChange={setAvisar} />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao type="submit" carregando={enviando} className="w-full">Enviar boletos</Botao>
        </form>
      )}
    </Modal>
  )
}

function Baixas({ onFechar }: { onFechar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<{ baixados: number; erros: { linha: number; motivo: string }[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    try {
      setResultado(await api('/admin/boletos/baixas', { method: 'POST', form: formData({ planilha: arquivo }) }))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo="Baixa de pagamentos por planilha" onFechar={onFechar} largura="max-w-xl">
      {resultado ? (
        <div className="space-y-3 text-sm">
          <Aviso tom="verde" titulo={`${resultado.baixados} pagamento(s) baixado(s)`} />
          {resultado.erros.length > 0 && (
            <Aviso tom="amarelo" titulo={`${resultado.erros.length} linha(s) não baixada(s)`}>
              <ul className="mt-1 max-h-48 list-inside list-disc overflow-y-auto">{resultado.erros.map(e => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}</ul>
            </Aviso>
          )}
          <Botao onClick={onFechar}>Concluir</Botao>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-stone-600">Monte uma planilha com os pagamentos do extrato/retorno do banco e salve como <b>CSV</b>:</p>
          <pre className="overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs">cpf_cnpj;competencia;data_pagamento;valor_pago{'\n'}123.456.789-09;10/2026;12/10/2026;95,00</pre>
          <p className="text-stone-600">No lugar de <b>cpf_cnpj</b> pode usar uma coluna <b>matricula</b>.</p>
          <input type="file" accept=".csv,text/csv" onChange={e => setArquivo(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-siran-100 file:px-4 file:py-2 file:font-medium file:text-siran-900" />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao onClick={enviar} disabled={!arquivo} carregando={enviando}>Processar baixas</Botao>
        </div>
      )}
    </Modal>
  )
}

function AcoesBoleto({ b, onFechar, onAlterado }: { b: Boleto; onFechar: () => void; onAlterado: () => void }) {
  const [pagoEm, setPagoEm] = useState(hoje())
  const [valorPago, setValorPago] = useState(String(b.valor).replace('.', ','))
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function situacao(status: string, extra: Record<string, string> = {}) {
    try {
      await api(`/admin/boletos/${b.id}/situacao`, { method: 'POST', body: { status, ...extra } })
      toast('Boleto atualizado.')
      onAlterado()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  async function excluir() {
    if (!(await confirmar('Excluir boleto', 'O boleto e o PDF serão apagados.', 'Excluir', true))) return
    try {
      await api(`/admin/boletos/${b.id}`, { method: 'DELETE' })
      toast('Boleto excluído.')
      onAlterado()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <Modal aberto titulo={`${b.nome} · ${competencia(b.competencia)}`} onFechar={onFechar}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>{moeda(b.valor)} · vence {data(b.vencimento)}</span>
          <StatusBoleto status={b.status} vencido={b.vencido} />
        </div>
        {!!b.tem_arquivo && <Botao variante="secundario" icone={<FileText className="size-4" />} onClick={() => abrirArquivo(`/admin/boletos/${b.id}/arquivo`).catch(e => toast(e.message, 'erro'))}>Ver PDF</Botao>}
        {b.status === 'aberto' && (
          <div className="space-y-3 rounded-xl border border-stone-200 p-4">
            <p className="font-medium">Registrar pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <Entrada rotulo="Pago em" type="date" value={pagoEm} onChange={e => setPagoEm(e.target.value)} />
              <Entrada rotulo="Valor pago" value={valorPago} onChange={e => setValorPago(e.target.value)} />
            </div>
            <Botao icone={<CheckCircle2 className="size-4" />} onClick={() => situacao('pago', { pago_em: pagoEm, valor_pago: valorPago })}>Dar baixa</Botao>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          {b.status === 'pago' && <Botao variante="secundario" tamanho="sm" onClick={() => situacao('aberto')}>Estornar pagamento</Botao>}
          {b.status === 'aberto' && <Botao variante="secundario" tamanho="sm" onClick={() => situacao('cancelado')}>Cancelar boleto</Botao>}
          {b.status === 'cancelado' && <Botao variante="secundario" tamanho="sm" onClick={() => situacao('aberto')}>Reabrir</Botao>}
          {b.status !== 'pago' && <Botao variante="fantasma" tamanho="sm" className="!text-red-700" onClick={excluir}>Excluir</Botao>}
        </div>
      </div>
      {elemento}
    </Modal>
  )
}
