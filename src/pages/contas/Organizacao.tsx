import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, FileText, GraduationCap, MessageCircle, Save, Users, XCircle } from 'lucide-react'
import { abrirArquivo, api, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useConta, type TipoConta } from '../../lib/auth'
import { data, linkWhatsapp, mascaraTelefone, UFS } from '../../lib/format'
import { AreaTexto, Botao, Cabecalho, Carregando, Cartao, Entrada, Etiqueta, Modal, Selecao, Vazio, cx, useConfirmacao, useToast } from '../../components/ui'
import { EtiquetaTipoVaga, StatusCandidatura } from '../../components/vagas'
import { FormTrocarSenha } from '../../components/TrocarSenha'
import type { Conta } from '../../lib/tipos'

/* ── Perfil de empresa parceira ou instituição de ensino ── */
export function PerfilOrganizacao({ tipo }: { tipo: TipoConta }) {
  const { usuario, setUsuario } = useConta(tipo)
  const [d, setD] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()
  useEffect(() => {
    if (!usuario) return
    const v = Object.fromEntries(Object.entries(usuario).map(([k, x]) => [k, x === null || x === undefined ? '' : String(x)]))
    setD({ ...v, telefone: mascaraTelefone(v.telefone || ''), whatsapp: mascaraTelefone(v.whatsapp || '') })
  }, [usuario])
  if (!usuario) return null
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const r = await api<{ conta: Conta }>(`/${tipo}/perfil`, { method: 'PUT', body: d })
      setUsuario(r.conta)
      toast('Dados salvos.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Cabecalho titulo={usuario.nome} descricao={usuario.cnpj ? `CNPJ ${usuario.cnpj}` : 'Dados de contato'} />
      <form onSubmit={salvar}>
        <Cartao className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="Responsável" value={d.responsavel || ''} onChange={e => set('responsavel', e.target.value)} />
            <Entrada rotulo="Cargo" value={d.cargo || ''} onChange={e => set('cargo', e.target.value)} />
            <Entrada rotulo="WhatsApp" value={d.whatsapp || ''} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
            <Entrada rotulo="Telefone" value={d.telefone || ''} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
            {tipo === 'empresa' && <>
              <Entrada rotulo="Cidade" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} />
              <Selecao rotulo="UF" value={d.uf || 'SP'} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
            </>}
            <Entrada rotulo="Site" className="sm:col-span-2" value={d.site || ''} onChange={e => set('site', e.target.value)} />
            <AreaTexto rotulo={tipo === 'empresa' ? 'Sobre a empresa' : 'Sobre a instituição'} className="sm:col-span-2" value={d.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-stone-500">Para alterar nome, CNPJ ou e-mail de acesso, fale com o SIRAN.</p>
          <Botao type="submit" carregando={salvando} icone={<Save className="size-4" />}>Salvar</Botao>
        </Cartao>
      </form>
      <Cartao className="p-5"><h2 className="mb-4 font-semibold">Trocar senha</h2><div className="max-w-sm"><FormTrocarSenha area={tipo} onConcluir={() => {}} /></div></Cartao>
    </div>
  )
}

/* ═══════════════ Instituição de ensino ═══════════════ */
type Estudante = {
  id: number; nome: string; email: string; whatsapp: string | null; cidade: string | null; curso: string | null; periodo: string | null
  matricula: string | null; previsao_conclusao: string | null; vinculo_status: string; vinculo_em: string | null; created_at: string; candidaturas: number
}

export function InstituicaoEstudantes() {
  const [filtro, setFiltro] = useState('')
  const { dados, carregando, recarregar } = useApi<Estudante[]>(`/instituicao/estudantes${qs({ status: filtro })}`)
  const [aberto, setAberto] = useState<number | null>(null)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function decidir(e: Estudante, decisao: 'confirmado' | 'recusado') {
    if (decisao === 'recusado' && !(await confirmar('Não confirmar matrícula', `${e.nome} não aparece como aluno da instituição? O estudante será avisado para conferir os dados.`, 'Não confirmar', true))) return
    try {
      await api(`/instituicao/estudantes/${e.id}/vinculo`, { method: 'POST', body: { decisao } })
      toast(decisao === 'confirmado' ? 'Matrícula confirmada.' : 'Estudante avisado.')
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <div>
      <Cabecalho titulo="Estudantes" descricao="Alunos que informaram sua instituição ao se cadastrar para vagas de estágio. Confirme a matrícula de quem estuda com vocês." />
      <div className="mb-5 flex flex-wrap gap-2">
        {[['', 'Todos'], ['pendente', 'Aguardando confirmação'], ['confirmado', 'Confirmados'], ['recusado', 'Não confirmados']].map(([k, r]) => (
          <button key={r} onClick={() => setFiltro(k)} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', filtro === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : !dados?.length ? (
        <Vazio icone={<GraduationCap />} titulo="Nenhum estudante nesta lista">Quando um aluno se cadastrar informando sua instituição, ele aparece aqui.</Vazio>
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {dados.map(e => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <button onClick={() => setAberto(e.id)} className="min-w-0 flex-1 text-left">
                <p className="font-medium text-stone-900 hover:underline">{e.nome}</p>
                <p className="text-sm text-stone-500">{[e.curso, e.periodo, e.matricula && `matrícula ${e.matricula}`].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-stone-400">{e.email}{e.candidaturas ? ` · ${e.candidaturas} candidatura(s)` : ''}</p>
              </button>
              {e.vinculo_status === 'pendente' ? (
                <div className="flex gap-2">
                  <Botao tamanho="sm" icone={<CheckCircle2 className="size-4" />} onClick={() => decidir(e, 'confirmado')}>Confirmar matrícula</Botao>
                  <Botao variante="secundario" tamanho="sm" icone={<XCircle className="size-4" />} onClick={() => decidir(e, 'recusado')}>Não é nosso aluno</Botao>
                </div>
              ) : e.vinculo_status === 'confirmado' ? <Etiqueta tom="verde">Matrícula confirmada</Etiqueta> : <Etiqueta tom="vermelho">Não confirmado</Etiqueta>}
            </div>
          ))}
        </Cartao>
      )}
      {aberto && <FichaEstudante id={aberto} onFechar={() => setAberto(null)} />}
      {elemento}
    </div>
  )
}

function FichaEstudante({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { dados } = useApi<{ estudante: Record<string, string | number | null>; candidaturas: { status: string; created_at: string; titulo: string; tipo: string; cidade: string }[] }>(`/instituicao/estudantes/${id}`)
  const toast = useToast()
  const e = dados?.estudante
  const whats = e && linkWhatsapp(String(e.whatsapp || ''))
  return (
    <Modal aberto titulo={e ? String(e.nome) : 'Estudante'} onFechar={onFechar} largura="max-w-xl">
      {!e ? <Carregando /> : (
        <div className="space-y-4 text-sm">
          <p className="text-stone-600">{[e.curso, e.periodo, e.matricula && `matrícula ${e.matricula}`, e.cidade].filter(Boolean).join(' · ')}</p>
          <div className="flex flex-wrap gap-3">
            {whats && <a href={whats} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#1f9d55]"><MessageCircle className="size-4" /> {mascaraTelefone(String(e.whatsapp))}</a>}
            <a href={`mailto:${e.email}`} className="text-siran-700 hover:underline">{e.email}</a>
            {!!e.tem_curriculo && <Botao variante="secundario" tamanho="sm" icone={<FileText className="size-4" />} onClick={() => abrirArquivo(`/instituicao/estudantes/${id}/curriculo`).catch(er => toast(er.message, 'erro'))}>Currículo</Botao>}
          </div>
          {e.resumo && <p className="whitespace-pre-line text-stone-700">{String(e.resumo)}</p>}
          <div>
            <p className="mb-2 font-semibold">Candidaturas</p>
            {!dados.candidaturas.length ? <p className="text-stone-500">Nenhuma candidatura ainda.</p> : (
              <ul className="divide-y divide-stone-100">
                {dados.candidaturas.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 py-2"><EtiquetaTipoVaga tipo={c.tipo} /><span className="flex-1">{c.titulo} · {c.cidade}</span><StatusCandidatura status={c.status} /></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export function InstituicaoCandidaturas() {
  const { dados, carregando } = useApi<{ id: number; status: string; created_at: string; updated_at: string; estudante: string; curso: string; titulo: string; tipo: string; cidade: string; ofertante: string }[]>('/instituicao/candidaturas')
  return (
    <div>
      <Cabecalho titulo="Candidaturas dos estudantes" descricao="Acompanhe em quais vagas seus alunos com matrícula confirmada se candidataram e em que etapa estão." />
      {carregando && !dados ? <Carregando /> : !dados?.length ? <Vazio icone={<Users />} titulo="Nenhuma candidatura ainda" /> : (
        <Cartao className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr><th className="px-4 py-3 font-medium">Estudante</th><th className="px-4 py-3 font-medium">Vaga</th><th className="hidden px-4 py-3 font-medium md:table-cell">Contratante</th><th className="px-4 py-3 font-medium">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dados.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><p className="font-medium">{c.estudante}</p><p className="text-xs text-stone-500">{c.curso}</p></td>
                  <td className="px-4 py-3"><p>{c.titulo}</p><p className="text-xs text-stone-500"><EtiquetaTipoVaga tipo={c.tipo} /> {c.cidade}</p></td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.ofertante}</td>
                  <td className="px-4 py-3"><StatusCandidatura status={c.status} /><p className="mt-1 text-xs text-stone-400">{data(c.updated_at)}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
    </div>
  )
}
