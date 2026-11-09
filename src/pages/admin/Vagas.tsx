import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, Briefcase, CheckCircle2, FileText, GraduationCap, Mail, Plus, RotateCcw, Search, Send, Trash2, Users, XCircle } from 'lucide-react'
import { abrirArquivo, api, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data, dataHora, mascaraDocumento, mascaraTelefone, UFS } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Modal, Paginacao, Selecao, Vazio, cx, useConfirmacao, useToast } from '../../components/ui'
import { EtiquetaTipoVaga, StatusCandidatura, StatusVaga } from '../../components/vagas'
import { ESCOLARIDADE, NIVEL_ESTAGIO, type Paginado, type Vaga } from '../../lib/tipos'

/* ═══════════════ Moderação de vagas ═══════════════ */
const ABAS = [['pendente', 'Aguardando moderação'], ['aprovada', 'Publicadas'], ['reprovada', 'Reprovadas'], ['expirada', 'Expiradas'], ['encerrada', 'Encerradas'], ['', 'Todas']]
const MOTIVOS = ['Informe a remuneração ou faixa salarial.', 'Descreva melhor as atividades e requisitos.', 'Vaga fora do perfil da plataforma (agro).', 'Estágio precisa informar nível e cursos aceitos.']

export function AdmVagas() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'pendente'
  const { dados, erro, carregando, recarregar } = useApi<Paginado<Vaga & { status_exibido: string }>>(`/admin/vagas${qs({ status, pagina: params.get('pagina') })}`)
  const [aberta, setAberta] = useState<number | null>(null)
  return (
    <div>
      <Cabecalho titulo="Vagas de emprego e estágio" descricao="Revise as vagas antes de publicar no mural." />
      <div className="mb-5 flex flex-wrap gap-2">
        {ABAS.map(([k, r]) => (
          <button key={r} onClick={() => setParams({ status: k })} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', status === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
        <Vazio icone={<Briefcase />} titulo={status === 'pendente' ? 'Nenhuma vaga aguardando moderação 🎉' : 'Nenhuma vaga'} />
      ) : (
        <>
          <div className="space-y-3">
            {dados.itens.map(v => (
              <Cartao key={v.id} className="flex cursor-pointer flex-wrap items-center gap-3 p-4 hover:border-siran-600" onClick={() => setAberta(v.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><StatusVaga status={v.status_exibido} /><EtiquetaTipoVaga tipo={v.tipo} /><span className="text-xs text-stone-500">{v.area}</span></div>
                  <p className="mt-1 font-medium text-stone-900">{v.titulo}</p>
                  <p className="text-sm text-stone-500">{v.ofertante_nome} ({v.ofertante_tipo === 'associado' ? 'associado' : 'empresa parceira'}) · {v.cidade} · {dataHora(v.updated_at)}</p>
                </div>
                <span className="flex items-center gap-1 text-sm text-stone-600"><Users className="size-4" /> {v.candidaturas}</span>
              </Cartao>
            ))}
          </div>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={p => setParams({ status, pagina: String(p) })} />
        </>
      )}
      {aberta && <ModerarVaga id={aberta} onFechar={() => setAberta(null)} onFeito={() => { setAberta(null); recarregar() }} />}
    </div>
  )
}

function ModerarVaga({ id, onFechar, onFeito }: { id: number; onFechar: () => void; onFeito: () => void }) {
  const { dados: v } = useApi<Vaga & { status_exibido: string; matricula: string | null; lista_candidaturas: { id: number; status: string; nome: string; cidade: string; created_at: string }[] }>(`/admin/vagas/${id}`)
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function moderar(decisao: 'aprovar' | 'reprovar') {
    setEnviando(true)
    try { await api(`/admin/vagas/${id}/moderar`, { method: 'POST', body: { decisao, motivo } }); toast(decisao === 'aprovar' ? 'Vaga publicada.' : 'Vaga devolvida para ajuste.'); onFeito() }
    catch (e) { toast((e as Error).message, 'erro') } finally { setEnviando(false) }
  }
  async function excluir() {
    if (!(await confirmar('Excluir vaga', 'A vaga e as candidaturas dela serão apagadas.', 'Excluir', true))) return
    try { await api(`/admin/vagas/${id}`, { method: 'DELETE' }); onFeito() } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <Modal aberto titulo="Vaga" onFechar={onFechar} largura="max-w-2xl"
      rodape={v && <>
        <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<Trash2 className="size-4" />} onClick={excluir}>Excluir</Botao>
        {!reprovando && v.status !== 'reprovada' && <Botao variante="secundario" icone={<XCircle className="size-4" />} onClick={() => setReprovando(true)}>Reprovar</Botao>}
        {reprovando && <Botao variante="perigo" carregando={enviando} disabled={!motivo.trim()} onClick={() => moderar('reprovar')}>Confirmar reprovação</Botao>}
        {!reprovando && v.status_exibido !== 'aprovada' && <Botao carregando={enviando} icone={<CheckCircle2 className="size-4" />} onClick={() => moderar('aprovar')}>Aprovar e publicar</Botao>}
      </>}>
      {!v ? <Carregando /> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><StatusVaga status={v.status_exibido} /><EtiquetaTipoVaga tipo={v.tipo} /><span className="text-stone-500">{v.area}</span></div>
          <h3 className="text-lg font-semibold">{v.titulo}</h3>
          <p className="text-stone-600">{v.ofertante_nome}{v.matricula ? ` (associado ${v.matricula})` : ' (empresa parceira)'} · {v.cidade}/{v.uf} · {v.quantidade} vaga(s){!v.exibir_nome && ' · nome oculto no anúncio'}</p>
          {[['Atividades', v.descricao], ['Requisitos', v.requisitos], ['Benefícios', v.beneficios], ['Remuneração', v.remuneracao], ['Jornada', v.jornada],
            ['Nível do estágio', v.estagio_nivel && NIVEL_ESTAGIO[v.estagio_nivel]], ['Cursos aceitos', v.estagio_cursos]].filter(([, t]) => t).map(([r, t]) => (
            <div key={r}><p className="text-xs uppercase tracking-wide text-stone-500">{r}</p><p className="whitespace-pre-line text-stone-800">{t}</p></div>
          ))}
          {v.motivo_reprovacao && !reprovando && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">Motivo da reprovação: {v.motivo_reprovacao}</p>}
          {v.lista_candidaturas.length > 0 && (
            <div><p className="mb-1 font-semibold">Candidaturas ({v.lista_candidaturas.length})</p>
              <ul className="divide-y divide-stone-100">{v.lista_candidaturas.map(c => <li key={c.id} className="flex items-center justify-between py-1.5"><span>{c.nome} · {c.cidade}</span><StatusCandidatura status={c.status} /></li>)}</ul>
            </div>
          )}
          {reprovando && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <div className="flex flex-wrap gap-1.5">{MOTIVOS.map(m => <button key={m} onClick={() => setMotivo(m)} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs hover:border-siran-600">{m}</button>)}</div>
              <AreaTexto rotulo="Motivo (quem publicou verá esta mensagem)" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} />
            </div>
          )}
        </div>
      )}
      {elemento}
    </Modal>
  )
}

/* ═══════════════ Empresas parceiras e instituições de ensino ═══════════════ */
type Org = {
  id: number; tipo: 'empresa' | 'instituicao'; nome: string; cnpj: string | null; responsavel: string | null; email: string; telefone: string | null; whatsapp: string | null
  cidade: string | null; uf: string | null; status: string; motivo_status: string | null; created_at: string; ultimo_login: string | null; tem_senha: number
  vagas: number; estudantes: number; estudantes_pendentes: number
}
const STATUS_ORG: Record<string, ['verde' | 'amarelo' | 'vermelho' | 'cinza', string]> = { ativa: ['verde', 'Ativa'], pendente: ['amarelo', 'Aguardando aprovação'], recusada: ['vermelho', 'Recusada'], suspensa: ['cinza', 'Suspensa'] }

export function AdmOrganizacoes() {
  const [params, setParams] = useSearchParams()
  const tipo = params.get('tipo') === 'instituicao' ? 'instituicao' : 'empresa'
  const { dados, carregando, recarregar } = useApi<Org[]>(`/admin/organizacoes?tipo=${tipo}`)
  const [form, setForm] = useState<Org | 'nova' | null>(null)
  const [statusDe, setStatusDe] = useState<{ o: Org; status: 'recusada' | 'suspensa' } | null>(null)
  const [motivo, setMotivo] = useState('')
  const toast = useToast()

  async function mudarStatus(o: Org, status: string, m?: string) {
    try { await api(`/admin/organizacoes/${o.id}/status`, { method: 'POST', body: { status, motivo: m } }); toast('Situação atualizada.'); setStatusDe(null); setMotivo(''); recarregar() } catch (e) { toast((e as Error).message, 'erro') }
  }
  async function convite(o: Org) {
    try { const r = await api<{ email: string }>(`/admin/organizacoes/${o.id}/convite`, { method: 'POST' }); toast(`Convite enviado para ${r.email}.`) } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <div>
      <Cabecalho titulo={tipo === 'empresa' ? 'Empresas parceiras' : 'Instituições de ensino'}
        descricao={tipo === 'empresa' ? 'Empresas não associadas que pedem acesso para publicar vagas.' : 'Escolas e faculdades convidadas pelo SIRAN para confirmar a matrícula dos estudantes nas vagas de estágio.'}
        acoes={<Botao icone={<Plus className="size-4" />} onClick={() => setForm('nova')}>{tipo === 'empresa' ? 'Cadastrar empresa' : 'Convidar instituição'}</Botao>} />
      <div className="mb-5 flex gap-2">
        {[['empresa', 'Empresas parceiras'], ['instituicao', 'Instituições de ensino']].map(([k, r]) => (
          <button key={k} onClick={() => setParams({ tipo: k })} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', tipo === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : !dados?.length ? (
        <Vazio icone={tipo === 'empresa' ? <Briefcase /> : <GraduationCap />} titulo={tipo === 'empresa' ? 'Nenhuma empresa cadastrada' : 'Nenhuma instituição convidada'}>
          {tipo === 'instituicao' && 'Convide ETECs, faculdades e institutos da região para que os estudantes delas possam concorrer a estágios.'}
        </Vazio>
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {dados.map(o => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
              <button onClick={() => setForm(o)} className="min-w-0 flex-1 text-left">
                <p className="font-medium text-stone-900 hover:underline">{o.nome} <Etiqueta tom={STATUS_ORG[o.status][0]}>{STATUS_ORG[o.status][1]}</Etiqueta></p>
                <p className="text-sm text-stone-500">{[o.cnpj && mascaraDocumento(o.cnpj), o.responsavel, o.email, o.cidade].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-stone-400">
                  {tipo === 'empresa' ? `${o.vagas} vaga(s)` : `${o.estudantes} estudante(s)${o.estudantes_pendentes ? ` · ${o.estudantes_pendentes} aguardando confirmação` : ''}`}
                  {' · '}{o.tem_senha ? `último acesso ${o.ultimo_login ? dataHora(o.ultimo_login) : 'nunca'}` : 'ainda não criou a senha'}
                  {o.motivo_status && ` · ${o.motivo_status}`}
                </p>
              </button>
              <div className="flex flex-wrap gap-2">
                {o.status === 'pendente' && <>
                  <Botao tamanho="sm" icone={<CheckCircle2 className="size-4" />} onClick={() => mudarStatus(o, 'ativa')}>Aprovar</Botao>
                  <Botao variante="secundario" tamanho="sm" icone={<XCircle className="size-4" />} onClick={() => setStatusDe({ o, status: 'recusada' })}>Recusar</Botao>
                </>}
                {o.status === 'ativa' && !o.tem_senha && <Botao variante="secundario" tamanho="sm" icone={<Mail className="size-4" />} onClick={() => convite(o)}>Reenviar convite</Botao>}
                {o.status === 'ativa' && <Botao variante="fantasma" tamanho="sm" icone={<Ban className="size-4" />} onClick={() => setStatusDe({ o, status: 'suspensa' })}>Suspender</Botao>}
                {['suspensa', 'recusada'].includes(o.status) && <Botao variante="secundario" tamanho="sm" icone={<RotateCcw className="size-4" />} onClick={() => mudarStatus(o, 'ativa')}>Reativar</Botao>}
              </div>
            </div>
          ))}
        </Cartao>
      )}
      {form && <FormOrganizacao tipo={tipo} o={form === 'nova' ? null : form} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); recarregar() }} />}
      <Modal aberto={!!statusDe} titulo={statusDe?.status === 'recusada' ? 'Recusar cadastro' : 'Suspender acesso'} onFechar={() => setStatusDe(null)}
        rodape={<><Botao variante="secundario" onClick={() => setStatusDe(null)}>Cancelar</Botao><Botao variante="perigo" disabled={!motivo.trim()} onClick={() => statusDe && mudarStatus(statusDe.o, statusDe.status, motivo)}>Confirmar</Botao></>}>
        <div className="space-y-3">
          {statusDe?.status === 'suspensa' && <p className="text-sm text-stone-600">O acesso é bloqueado e as vagas publicadas saem do ar.</p>}
          <AreaTexto rotulo="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} />
        </div>
      </Modal>
    </div>
  )
}

function FormOrganizacao({ tipo, o, onFechar, onSalvo }: { tipo: 'empresa' | 'instituicao'; o: Org | null; onFechar: () => void; onSalvo: () => void }) {
  const [d, setD] = useState<Record<string, string>>((): Record<string, string> => {
    if (!o) return { uf: 'SP' }
    const v: Record<string, string> = Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x === null ? '' : String(x)]))
    return { ...v, telefone: mascaraTelefone(o.telefone || ''), whatsapp: mascaraTelefone(o.whatsapp || ''), cnpj: o.cnpj ? mascaraDocumento(o.cnpj) : '' }
  })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      if (o) { await api(`/admin/organizacoes/${o.id}`, { method: 'PUT', body: d }); toast('Dados salvos.') }
      else {
        const r = await api<{ convite_enviado: boolean }>('/admin/organizacoes', { method: 'POST', body: { ...d, tipo } })
        toast(r.convite_enviado ? `Cadastrado. Convite enviado para ${d.email}.` : 'Cadastrado. O envio de e-mail não está configurado: use "Reenviar convite" depois.')
      }
      onSalvo()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo={o ? o.nome : tipo === 'empresa' ? 'Cadastrar empresa parceira' : 'Convidar instituição de ensino'} onFechar={onFechar} largura="max-w-xl"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao type="submit" form="form-org" carregando={enviando} icone={!o ? <Send className="size-4" /> : undefined}>{o ? 'Salvar' : 'Cadastrar e enviar convite'}</Botao></>}>
      <form id="form-org" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        {!o && <p className="text-sm text-stone-600 sm:col-span-2">O responsável recebe por e-mail um link (válido por 3 dias) para criar a senha de acesso.</p>}
        <Entrada rotulo={tipo === 'empresa' ? 'Razão social' : 'Nome da instituição'} className="sm:col-span-2" value={d.nome || ''} onChange={e => set('nome', e.target.value)} required />
        <Entrada rotulo="CNPJ" value={d.cnpj || ''} onChange={e => set('cnpj', mascaraDocumento(e.target.value))} />
        <Entrada rotulo="Responsável" value={d.responsavel || ''} onChange={e => set('responsavel', e.target.value)} placeholder={tipo === 'instituicao' ? 'Coordenação de estágios' : ''} />
        <Entrada rotulo="E-mail de acesso" type="email" className="sm:col-span-2" value={d.email || ''} onChange={e => set('email', e.target.value)} required />
        <Entrada rotulo="WhatsApp" value={d.whatsapp || ''} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="Telefone" value={d.telefone || ''} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="Cidade" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} />
        <Selecao rotulo="UF" value={d.uf || 'SP'} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
        <Entrada rotulo="Site" className="sm:col-span-2" value={d.site || ''} onChange={e => set('site', e.target.value)} />
        {erro && <div className="sm:col-span-2"><Aviso tom="vermelho">{erro}</Aviso></div>}
      </form>
    </Modal>
  )
}

/* ═══════════════ Banco de candidatos ═══════════════ */
type CandidatoLinha = { id: number; nome: string; email: string; whatsapp: string | null; cidade: string | null; escolaridade: string | null; estudante: number; curso: string | null; vinculo_status: string; instituicao: string | null; tem_curriculo: number; candidaturas: number; created_at: string }

export function AdmCandidatos() {
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [estudantes, setEstudantes] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { dados, carregando, recarregar } = useApi<Paginado<CandidatoLinha>>(`/admin/candidatos${qs({ q, estudantes: estudantes ? 1 : '', pagina })}`)
  const [aberto, setAberto] = useState<number | null>(null)
  return (
    <div>
      <Cabecalho titulo="Candidatos" descricao={dados ? `${dados.total} currículo(s) cadastrado(s)` : undefined} />
      <div className="mb-5 flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); setQ(busca.trim()); setPagina(1) }} className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, e-mail, cidade ou curso" className="campo !pl-10" aria-label="Buscar" />
        </form>
        <button onClick={() => { setEstudantes(!estudantes); setPagina(1) }} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', estudantes ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>Só estudantes</button>
      </div>
      {carregando && !dados ? <Carregando /> : !dados?.itens.length ? <Vazio icone={<Users />} titulo="Nenhum candidato" /> : (
        <>
          <Cartao className="divide-y divide-stone-100">
            {dados.itens.map(k => (
              <button key={k.id} onClick={() => setAberto(k.id)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-stone-50">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{k.nome}</p>
                  <p className="text-sm text-stone-500">{[k.cidade, k.escolaridade && ESCOLARIDADE[k.escolaridade], k.estudante ? `${k.curso} – ${k.instituicao}` : null].filter(Boolean).join(' · ')}</p>
                </div>
                {k.estudante === 1 && (k.vinculo_status === 'confirmado' ? <Etiqueta tom="verde">Matrícula confirmada</Etiqueta> : <Etiqueta>Estudante</Etiqueta>)}
                <span className="text-sm text-stone-500">{k.candidaturas} candidatura(s)</span>
              </button>
            ))}
          </Cartao>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.por_pagina} onChange={setPagina} />
        </>
      )}
      {aberto && <FichaCandidato id={aberto} onFechar={() => setAberto(null)} onExcluido={() => { setAberto(null); recarregar() }} />}
    </div>
  )
}

function FichaCandidato({ id, onFechar, onExcluido }: { id: number; onFechar: () => void; onExcluido: () => void }) {
  const { dados } = useApi<{ candidato: Record<string, string | number | null>; candidaturas: { status: string; created_at: string; titulo: string; tipo: string }[] }>(`/admin/candidatos/${id}`)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()
  const k = dados?.candidato
  async function excluir() {
    if (!(await confirmar('Excluir candidato', 'Apaga o cadastro, o currículo e as candidaturas. Use quando o titular pedir a exclusão dos dados (LGPD).', 'Excluir definitivamente', true))) return
    try { await api(`/admin/candidatos/${id}`, { method: 'DELETE' }); toast('Cadastro excluído.'); onExcluido() } catch (e) { toast((e as Error).message, 'erro') }
  }
  return (
    <Modal aberto titulo={k ? String(k.nome) : 'Candidato'} onFechar={onFechar} largura="max-w-xl"
      rodape={k && <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<Trash2 className="size-4" />} onClick={excluir}>Excluir cadastro (LGPD)</Botao>}>
      {!k ? <Carregando /> : (
        <div className="space-y-3 text-sm">
          <p className="text-stone-600">{[k.cpf && mascaraDocumento(String(k.cpf)), k.email, k.whatsapp && mascaraTelefone(String(k.whatsapp)), k.cidade].filter(Boolean).join(' · ')}</p>
          {k.estudante ? <p><GraduationCap className="mr-1 inline size-4" />{k.curso} {k.periodo ? `· ${k.periodo}` : ''} — {k.instituicao} ({k.vinculo_status === 'confirmado' ? 'matrícula confirmada' : 'não confirmada'})</p> : null}
          {k.resumo && <p className="whitespace-pre-line text-stone-700">{String(k.resumo)}</p>}
          {k.experiencias && <p className="whitespace-pre-line text-stone-700">{String(k.experiencias)}</p>}
          {!!k.tem_curriculo && <Botao variante="secundario" tamanho="sm" icone={<FileText className="size-4" />} onClick={() => abrirArquivo(`/admin/candidatos/${id}/curriculo`).catch(e => toast(e.message, 'erro'))}>Currículo (PDF)</Botao>}
          <p className="text-xs text-stone-400">Cadastrado em {data(String(k.created_at))}</p>
          <div><p className="mb-1 font-semibold">Candidaturas</p>
            {!dados.candidaturas.length ? <p className="text-stone-500">Nenhuma.</p> : <ul className="divide-y divide-stone-100">{dados.candidaturas.map((c, i) => <li key={i} className="flex items-center gap-2 py-1.5"><EtiquetaTipoVaga tipo={c.tipo} /><span className="flex-1">{c.titulo}</span><StatusCandidatura status={c.status} /></li>)}</ul>}
          </div>
        </div>
      )}
      {elemento}
    </Modal>
  )
}
