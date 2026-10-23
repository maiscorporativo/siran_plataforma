import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, CheckCircle2, Copy, FileText, KeyRound, MessageCircle, Receipt, RotateCcw, Save, Send, Trash2, Upload, UserX, XCircle } from 'lucide-react'
import { abrirArquivo, api, formData } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { competencia, data, dataHora, linkWhatsapp, mascaraDocumento, moeda, tamanhoArquivo } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Modal, useConfirmacao, useCopiar, useToast } from '../../components/ui'
import { SituacaoAssociado, StatusBoleto, StatusRecredenciamento } from '../../components/Status'
import { CamposContato, CamposEndereco, CamposPropriedade, paraFormulario, type Dados } from '../../components/CamposCadastro'
import { EnvioDocumentos, TIPOS_DOCUMENTO, anexarDocumentos, type DocumentoNovo } from '../../components/EnvioDocumentos'
import type { Associado } from '../../lib/tipos'

type Ficha = {
  associado: Associado
  documentos: { id: number; tipo: string; nome_original: string; tamanho: number; recredenciamento_id: number | null; created_at: string }[]
  recredenciamentos: { id: number; status: string; resposta: string | null; validade_nova: string | null; created_at: string }[]
  boletos: { id: number; competencia: string; valor: number; vencimento: string; status: string; pago_em: string | null; vencido: number }[]
  anuncios: { total: number; publicados: number | null }
  historico: { acao: string; detalhes: string | null; created_at: string; admin: string | null }[]
}

const ACOES: Record<string, string> = {
  criar: 'Cadastro criado pela equipe', editar: 'Dados editados', aprovar: 'Filiação aprovada', senha_provisoria: 'Senha provisória gerada',
  validade: 'Validade alterada', anexar_documento: 'Documento anexado', remover_documento: 'Documento removido', lancar_boleto: 'Boleto lançado',
  excluir_boleto: 'Boleto excluído', 'status:recusado': 'Filiação recusada', 'status:suspenso': 'Associado suspenso', 'status:inativo': 'Associado inativado',
  'status:ativo': 'Associado reativado', 'recredenciamento:aprovado': 'Recredenciamento aprovado', 'recredenciamento:pendencia': 'Pendência no recredenciamento',
  'recredenciamento:reprovado': 'Recredenciamento reprovado', 'boleto:pago': 'Baixa manual de boleto', 'boleto:aberto': 'Boleto estornado', 'boleto:cancelado': 'Boleto cancelado',
}

export default function AssociadoFicha() {
  const { id } = useParams()
  const { dados: ficha, erro, carregando, recarregar } = useApi<Ficha>(`/admin/associados/${id}`)
  const [form, setForm] = useState<Dados>({})
  const [salvando, setSalvando] = useState(false)
  const [novosDocs, setNovosDocs] = useState<DocumentoNovo[]>([])
  const [modalStatus, setModalStatus] = useState<'recusado' | 'suspenso' | 'inativo' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [aprovar, setAprovar] = useState(false)
  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState<string | null>(null)
  const toast = useToast()
  const copiar = useCopiar()
  const { confirmar, elemento } = useConfirmacao()

  useEffect(() => { if (ficha) setForm(paraFormulario(ficha.associado as unknown as Record<string, unknown>)) }, [ficha])

  if (carregando && !ficha) return <Carregando />
  if (erro || !ficha) return <><Cabecalho titulo="Associado" voltar="/admin/associados" /><Erro mensagem={erro || ''} tentar={recarregar} /></>

  const a = ficha.associado
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function executar(fn: () => Promise<unknown>, mensagem: string) {
    try {
      await fn()
      toast(mensagem)
      recarregar()
      return true
    } catch (err) {
      toast((err as Error).message, 'erro')
      return false
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    await executar(() => api(`/admin/associados/${a.id}`, { method: 'PUT', body: form }), 'Dados salvos.')
    setSalvando(false)
  }

  async function confirmarAprovacao() {
    if (await executar(() => api(`/admin/associados/${a.id}/aprovar`, { method: 'POST', body: { matricula } }), 'Filiação aprovada!')) setAprovar(false)
  }

  async function mudarStatus() {
    if (!modalStatus) return
    if (await executar(() => api(`/admin/associados/${a.id}/status`, { method: 'POST', body: { status: modalStatus, motivo } }), 'Situação atualizada.')) {
      setModalStatus(null); setMotivo('')
    }
  }

  async function reativar() {
    if (await confirmar('Reativar associado', `Reativar ${a.nome}?`, 'Reativar')) {
      executar(() => api(`/admin/associados/${a.id}/status`, { method: 'POST', body: { status: 'ativo' } }), 'Associado reativado.')
    }
  }

  async function gerarSenha() {
    const msg = a.tem_senha
      ? 'A senha atual deixará de funcionar e o associado terá que criar uma nova no próximo acesso.'
      : 'Será criada uma senha provisória para o primeiro acesso do associado.'
    if (!(await confirmar('Gerar senha provisória', msg, 'Gerar senha'))) return
    try {
      const r = await api<{ senha: string }>(`/admin/associados/${a.id}/senha-provisoria`, { method: 'POST' })
      setSenha(r.senha)
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  async function enviarAcesso() {
    if (!(await confirmar('Enviar link de acesso', 'O associado recebe por WhatsApp e/ou e-mail um link (válido por 3 dias) para criar a própria senha.', 'Enviar'))) return
    try {
      const r = await api<{ email: string | null; whatsapp: string | null }>(`/admin/associados/${a.id}/enviar-acesso`, { method: 'POST' })
      toast(`Link enviado para ${[r.whatsapp && `WhatsApp ${r.whatsapp}`, r.email && `e-mail ${r.email}`].filter(Boolean).join(' e ')}.`)
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  async function enviarDocs() {
    const f = formData({})
    anexarDocumentos(f, novosDocs)
    if (await executar(() => api(`/admin/associados/${a.id}/documentos`, { method: 'POST', form: f }), 'Documentos anexados.')) setNovosDocs([])
  }

  async function removerDoc(docId: number, nome: string) {
    if (await confirmar('Remover documento', `Remover "${nome}" definitivamente?`, 'Remover', true)) {
      executar(() => api(`/admin/associados/documentos/${docId}`, { method: 'DELETE' }), 'Documento removido.')
    }
  }

  const msgSenha = senha && `Olá, ${a.nome.split(' ')[0]}! Seu acesso à Área do Associado do SIRAN foi liberado.\n\nEndereço: ${window.location.origin}/entrar\nCPF/CNPJ: ${mascaraDocumento(a.cpf_cnpj)}\nSenha provisória: ${senha}\n\nNo primeiro acesso você vai criar sua senha pessoal.`

  return (
    <div>
      <Cabecalho titulo={a.nome} voltar="/admin/associados"
        descricao={<span className="flex flex-wrap items-center gap-2">
          <SituacaoAssociado situacao={a.situacao} />
          {a.matricula && <span>Matrícula {a.matricula}</span>}
          <span>· {mascaraDocumento(a.cpf_cnpj)}</span>
          {a.ultimo_login && <span className="text-stone-400">· último acesso {dataHora(a.ultimo_login)}</span>}
        </span>}
        acoes={<>
          {a.status === 'pendente' && <>
            <Botao icone={<CheckCircle2 className="size-4" />} onClick={() => { setMatricula(''); setAprovar(true) }}>Aprovar filiação</Botao>
            <Botao variante="secundario" icone={<XCircle className="size-4" />} onClick={() => setModalStatus('recusado')}>Recusar</Botao>
          </>}
          {a.status === 'ativo' && <Botao variante="secundario" icone={<Ban className="size-4" />} onClick={() => setModalStatus('suspenso')}>Suspender</Botao>}
          {['suspenso', 'inativo', 'recusado'].includes(a.status) && <Botao variante="secundario" icone={<RotateCcw className="size-4" />} onClick={reativar}>Reativar</Botao>}
          {a.status !== 'recusado' && a.status !== 'inativo' && <Botao variante="secundario" icone={<Send className="size-4" />} onClick={enviarAcesso}>Enviar link de acesso</Botao>}
          <Botao variante="secundario" icone={<KeyRound className="size-4" />} onClick={gerarSenha}>Senha provisória</Botao>
        </>} />

      {a.motivo_status && a.status !== 'ativo' && <div className="mb-5"><Aviso tom="amarelo" titulo="Motivo registrado">{a.motivo_status}</Aviso></div>}
      {a.status === 'ativo' && !a.tem_senha && (
        <div className="mb-5"><Aviso tom="azul" titulo="Este associado ainda não tem acesso à plataforma"
          acao={<Botao tamanho="sm" onClick={enviarAcesso} icone={<Send className="size-4" />}>Enviar link de acesso</Botao>}>Envie o link para ele criar a própria senha, ou gere uma senha provisória.</Aviso></div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={salvar} className="space-y-6 xl:col-span-2">
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">Identificação e filiação</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Entrada rotulo="Nome / razão social" className="sm:col-span-2" value={form.nome || ''} onChange={e => set('nome', e.target.value)} required />
              <Entrada rotulo="CPF / CNPJ" value={mascaraDocumento(form.cpf_cnpj || '')} onChange={e => set('cpf_cnpj', e.target.value)} />
              <Entrada rotulo="RG / IE" value={form.rg_ie || ''} onChange={e => set('rg_ie', e.target.value)} />
              <Entrada rotulo="Data de nascimento" type="date" value={form.data_nascimento || ''} onChange={e => set('data_nascimento', e.target.value)} />
              <Entrada rotulo="Matrícula" value={form.matricula || ''} onChange={e => set('matricula', e.target.value)} />
              <Entrada rotulo="Associado desde" type="date" value={form.data_filiacao || ''} onChange={e => set('data_filiacao', e.target.value)} />
              <Entrada rotulo="Credenciamento válido até" type="date" value={form.validade_ate || ''} onChange={e => set('validade_ate', e.target.value)} />
            </div>
          </Cartao>
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">Contato e endereço</h2>
            <CamposContato dados={form} set={set} />
            <CamposEndereco dados={form} set={set} />
          </Cartao>
          <Cartao className="space-y-4 p-5">
            <h2 className="font-semibold">Propriedade rural</h2>
            <CamposPropriedade dados={form} set={set} />
          </Cartao>
          <Cartao className="space-y-4 p-5">
            <AreaTexto rotulo="Observações internas (não aparecem para o associado)" value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
          </Cartao>
          <Botao type="submit" carregando={salvando} icone={<Save className="size-4" />}>Salvar alterações</Botao>
        </form>

        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Contato rápido</h2>
            {linkWhatsapp(a.whatsapp) ? (
              <a href={linkWhatsapp(a.whatsapp)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1f9d55] px-3 py-2 text-sm font-medium text-white"><MessageCircle className="size-4" /> WhatsApp</a>
            ) : <p className="text-sm text-stone-500">Sem WhatsApp cadastrado.</p>}
            <p className="mt-3 text-sm text-stone-600">{ficha.anuncios.total} anúncio(s) · {ficha.anuncios.publicados || 0} publicado(s)</p>
          </Cartao>

          <Cartao className="space-y-3 p-5">
            <h2 className="font-semibold">Documentos</h2>
            {ficha.documentos.length === 0 ? <p className="text-sm text-stone-500">Nenhum documento.</p> : (
              <ul className="divide-y divide-stone-100">
                {ficha.documentos.map(d => (
                  <li key={d.id} className="flex items-center gap-2 py-2">
                    <FileText className="size-4 shrink-0 text-stone-400" />
                    <button onClick={() => abrirArquivo(`/admin/associados/documentos/${d.id}/arquivo`, d.nome_original).catch(e => toast(e.message, 'erro'))} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-siran-800 hover:underline">{TIPOS_DOCUMENTO[d.tipo] || d.tipo}</p>
                      <p className="truncate text-xs text-stone-500">{data(d.created_at)} · {tamanhoArquivo(d.tamanho)}{d.recredenciamento_id ? ' · recredenciamento' : ''}</p>
                    </button>
                    <button onClick={() => removerDoc(d.id, d.nome_original)} className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover"><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <EnvioDocumentos lista={novosDocs} onChange={setNovosDocs} />
            {novosDocs.length > 0 && <Botao tamanho="sm" onClick={enviarDocs} icone={<Upload className="size-4" />}>Anexar {novosDocs.length}</Botao>}
          </Cartao>

          <Cartao className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Boletos</h2>
              <Link to={`/admin/boletos?associado_id=${a.id}`} className="text-sm text-siran-700 hover:underline">Gerenciar</Link>
            </div>
            {ficha.boletos.length === 0 ? <p className="text-sm text-stone-500">Nenhum boleto lançado.</p> : (
              <ul className="divide-y divide-stone-100 text-sm">
                {ficha.boletos.map(b => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                    <span><Receipt className="mr-1 inline size-4 text-stone-400" />{competencia(b.competencia)} · {moeda(b.valor)}</span>
                    <StatusBoleto status={b.status} vencido={b.vencido} />
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {ficha.recredenciamentos.length > 0 && (
            <Cartao className="p-5">
              <h2 className="mb-3 font-semibold">Recredenciamentos</h2>
              <ul className="divide-y divide-stone-100 text-sm">
                {ficha.recredenciamentos.map(r => (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between gap-2"><span>{data(r.created_at)}</span><StatusRecredenciamento status={r.status} /></div>
                    {r.status === 'enviado' && <Link to="/admin/recredenciamentos" className="text-siran-700 hover:underline">Analisar</Link>}
                    {r.validade_nova && <p className="text-xs text-stone-500">Renovado até {data(r.validade_nova)}</p>}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Histórico</h2>
            {ficha.historico.length === 0 ? <p className="text-sm text-stone-500">Sem registros.</p> : (
              <ul className="space-y-2 text-sm">
                {ficha.historico.map((h, i) => (
                  <li key={i}>
                    <p className="text-stone-800">{ACOES[h.acao] || h.acao}{h.detalhes && h.acao.startsWith('status') ? `: ${h.detalhes}` : ''}</p>
                    <p className="text-xs text-stone-500">{dataHora(h.created_at)}{h.admin ? ` · ${h.admin}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-400">Cadastro criado em {dataHora(a.created_at)}</p>
          </Cartao>
        </div>
      </div>

      <Modal aberto={aprovar} titulo="Aprovar filiação" onFechar={() => setAprovar(false)}
        rodape={<><Botao variante="secundario" onClick={() => setAprovar(false)}>Cancelar</Botao><Botao onClick={confirmarAprovacao} icone={<CheckCircle2 className="size-4" />}>Aprovar</Botao></>}>
        <div className="space-y-4">
          <p className="text-[15px] text-stone-700">Ao aprovar, <b>{a.nome}</b> passa a ter acesso completo e o credenciamento vale a partir de hoje.</p>
          {ficha.documentos.length === 0 && <Aviso tom="amarelo">Nenhum documento foi enviado neste cadastro.</Aviso>}
          <Entrada rotulo="Matrícula" value={matricula} onChange={e => setMatricula(e.target.value)} dica="Deixe em branco para usar a próxima disponível." />
        </div>
      </Modal>

      <Modal aberto={!!modalStatus} titulo={{ recusado: 'Recusar filiação', suspenso: 'Suspender associado', inativo: 'Inativar associado' }[modalStatus || 'suspenso']} onFechar={() => setModalStatus(null)}
        rodape={<>
          {modalStatus === 'suspenso' && <Botao variante="fantasma" className="mr-auto !text-red-700" icone={<UserX className="size-4" />} onClick={() => setModalStatus('inativo')}>Inativar (desligamento)</Botao>}
          <Botao variante="secundario" onClick={() => setModalStatus(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={mudarStatus} disabled={!motivo.trim()}>Confirmar</Botao>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {modalStatus === 'recusado' && 'O motivo será exibido ao interessado quando tentar entrar.'}
            {modalStatus === 'suspenso' && 'O associado continua vendo boletos e cadastro, mas perde acesso a classificados, conveniados, comunicados e carteirinha.'}
            {modalStatus === 'inativo' && 'O associado deixa de acessar a plataforma. Use em caso de desligamento.'}
          </p>
          <AreaTexto rotulo="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} required />
        </div>
      </Modal>

      <Modal aberto={!!senha} titulo="Senha provisória gerada" onFechar={() => setSenha(null)}>
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Envie ao associado. Ela só aparece agora; no primeiro acesso ele cria a senha pessoal.</p>
          <p className="rounded-xl bg-siran-50 py-4 text-center font-mono text-2xl font-semibold tracking-widest text-siran-900">{senha}</p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" icone={<Copy className="size-4" />} onClick={() => copiar(msgSenha!, 'Mensagem copiada!')}>Copiar mensagem</Botao>
            {linkWhatsapp(a.whatsapp) && (
              <a href={linkWhatsapp(a.whatsapp, msgSenha!)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1f9d55] px-4 py-2.5 text-[15px] font-medium text-white"><MessageCircle className="size-4" /> Enviar pelo WhatsApp</a>
            )}
          </div>
        </div>
      </Modal>
      {elemento}
    </div>
  )
}
