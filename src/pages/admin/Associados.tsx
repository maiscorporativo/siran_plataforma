import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileUp, Plus, Search, Users } from 'lucide-react'
import { abrirArquivo, api, formData, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data, documentoValido, mascaraDocumento, mascaraTelefone } from '../../lib/format'
import { Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Modal, Paginacao, Selecao, Vazio, useToast } from '../../components/ui'
import { SituacaoAssociado } from '../../components/Status'
import type { Associado, Paginado } from '../../lib/tipos'

export default function Associados() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') || '')
  const [novo, setNovo] = useState(false)
  const [importar, setImportar] = useState(false)
  const f = (k: string) => params.get(k) || ''
  const filtros = { q: f('q'), status: f('status'), situacao: f('situacao'), inadimplente: f('inadimplente'), cidade: f('cidade'), ordem: f('ordem') }
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Associado> & { cidades: string[] }>(`/admin/associados${qs({ ...filtros, pagina: f('pagina') })}`)
  const toast = useToast()

  const mudar = (m: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(m)) v ? p.set(k, v) : p.delete(k)
    if (!('pagina' in m)) p.delete('pagina')
    setParams(p)
  }

  return (
    <div>
      <Cabecalho titulo="Associados" descricao={dados ? `${dados.total} encontrado(s)` : undefined}
        acoes={<>
          <Botao variante="secundario" icone={<Download className="size-4" />}
            onClick={() => abrirArquivo(`/admin/associados/exportar${qs(filtros)}`, 'associados.csv', { baixar: true }).catch(e => toast(e.message, 'erro'))}>Exportar</Botao>
          <Botao variante="secundario" icone={<FileUp className="size-4" />} onClick={() => setImportar(true)}>Importar planilha</Botao>
          <Botao icone={<Plus className="size-4" />} onClick={() => setNovo(true)}>Novo associado</Botao>
        </>} />

      <div className="grid gap-3 md:grid-cols-[1fr_repeat(3,minmax(0,180px))]">
        <form onSubmit={e => { e.preventDefault(); mudar({ q: busca.trim() }) }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, CPF/CNPJ, matrícula, e-mail, propriedade…" className="campo !pl-10" aria-label="Buscar" />
        </form>
        <select value={f('status')} onChange={e => mudar({ status: e.target.value })} className="campo" aria-label="Status">
          <option value="">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="ativo">Ativos</option>
          <option value="suspenso">Suspensos</option>
          <option value="recusado">Recusados</option>
          <option value="inativo">Inativos</option>
        </select>
        <select value={f('situacao') || (f('inadimplente') ? 'inadimplente' : '')} onChange={e => {
          const v = e.target.value
          mudar({ situacao: v === 'inadimplente' ? '' : v, inadimplente: v === 'inadimplente' ? '1' : '' })
        }} className="campo" aria-label="Situação">
          <option value="">Qualquer situação</option>
          <option value="renovar">Vencendo em breve</option>
          <option value="vencido">Credenciamento vencido</option>
          <option value="inadimplente">Com boleto vencido</option>
        </select>
        <select value={f('cidade')} onChange={e => mudar({ cidade: e.target.value })} className="campo" aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {dados?.cidades.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="mt-5">
        {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
          <Vazio icone={<Users />} titulo="Nenhum associado encontrado" />
        ) : (
          <>
            <Cartao className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Matr.</th>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Cidade</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Contato</th>
                    <th className="px-4 py-3 font-medium">Validade</th>
                    <th className="px-4 py-3 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dados.itens.map(a => (
                    <tr key={a.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-stone-500">{a.matricula || '—'}</td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/associados/${a.id}`} className="font-medium text-siran-900 hover:underline">{a.nome}</Link>
                        <p className="text-xs text-stone-500">{mascaraDocumento(a.cpf_cnpj)}{!a.tem_senha && a.status === 'ativo' && ' · sem acesso liberado'}</p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">{a.cidade}{a.uf ? `/${a.uf}` : ''}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">{a.whatsapp ? mascaraTelefone(a.whatsapp) : a.telefone ? mascaraTelefone(a.telefone) : '—'}</td>
                      <td className="px-4 py-3">{data(a.validade_ate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <SituacaoAssociado situacao={a.situacao} />
                          {!!a.boletos_vencidos && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{a.boletos_vencidos} boleto(s)</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
            <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => mudar({ pagina: String(p) })} />
          </>
        )}
      </div>

      <NovoAssociado aberto={novo} onFechar={() => setNovo(false)} />
      <Importar aberto={importar} onFechar={() => { setImportar(false); recarregar() }} />
    </div>
  )
}

function NovoAssociado({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [d, setD] = useState<Record<string, string>>({ status: 'ativo', uf: 'SP' })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!documentoValido(d.cpf_cnpj || '')) return setErro('CPF ou CNPJ inválido.')
    setEnviando(true)
    try {
      const r = await api<{ id: number }>('/admin/associados', { method: 'POST', body: d })
      navegar(`/admin/associados/${r.id}`)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto={aberto} titulo="Novo associado" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-stone-600">Use para cadastrar quem se filiou presencialmente. Depois, gere a senha provisória na ficha.</p>
        <Entrada rotulo="CPF ou CNPJ" value={d.cpf_cnpj || ''} onChange={e => set('cpf_cnpj', mascaraDocumento(e.target.value))} required />
        <Entrada rotulo="Nome / razão social" value={d.nome || ''} onChange={e => set('nome', e.target.value)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada rotulo="WhatsApp" value={d.whatsapp || ''} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
          <Entrada rotulo="Cidade" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} />
          <Entrada rotulo="Matrícula" value={d.matricula || ''} onChange={e => set('matricula', e.target.value)} dica="Em branco = próxima disponível" />
          <Selecao rotulo="Situação inicial" value={d.status} onChange={e => set('status', e.target.value)}>
            <option value="ativo">Ativo (filiação aprovada)</option>
            <option value="pendente">Pendente de análise</option>
          </Selecao>
        </div>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" carregando={enviando} className="w-full">Cadastrar e abrir ficha</Botao>
      </form>
    </Modal>
  )
}

function Importar({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<{ criados: number; ignorados: { linha: number; motivo: string }[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    try {
      setResultado(await api('/admin/associados/importar', { method: 'POST', form: formData({ planilha: arquivo }) }))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const fechar = () => { setArquivo(null); setResultado(null); setErro(null); onFechar() }

  return (
    <Modal aberto={aberto} titulo="Importar associados" onFechar={fechar} largura="max-w-xl">
      {resultado ? (
        <div className="space-y-3">
          <Aviso tom="verde" titulo={`${resultado.criados} associado(s) importado(s)`} />
          {resultado.ignorados.length > 0 && (
            <Aviso tom="amarelo" titulo={`${resultado.ignorados.length} linha(s) ignorada(s)`}>
              <ul className="mt-1 max-h-48 list-inside list-disc overflow-y-auto">{resultado.ignorados.map(i => <li key={i.linha}>Linha {i.linha}: {i.motivo}</li>)}</ul>
            </Aviso>
          )}
          <Botao onClick={fechar}>Concluir</Botao>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-stone-600">Carga inicial dos associados atuais, a partir de uma planilha salva como <b>CSV</b> (separada por ponto e vírgula). A primeira linha deve ter os nomes das colunas:</p>
          <pre className="overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs">nome;cpf_cnpj;matricula;email;whatsapp;telefone;cidade;uf;data_filiacao;validade</pre>
          <p className="text-stone-600">Obrigatórias: <b>nome</b> e <b>cpf_cnpj</b>. Importados entram como <b>ativos e sem senha</b>: o acesso é liberado gerando uma senha provisória na ficha de cada um. CPFs já cadastrados são ignorados.</p>
          <input type="file" accept=".csv,text/csv" onChange={e => setArquivo(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-siran-100 file:px-4 file:py-2 file:font-medium file:text-siran-900" />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao onClick={enviar} disabled={!arquivo} carregando={enviando} icone={<FileUp className="size-4" />}>Importar</Botao>
        </div>
      )}
    </Modal>
  )
}
