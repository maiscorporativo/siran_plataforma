import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, FileText, Save, Search, Trash2, Upload } from 'lucide-react'
import { abrirArquivo, api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useCandidato } from '../../lib/auth'
import { data, mascaraTelefone, UFS } from '../../lib/format'
import { AreaTexto, Aviso, Botao, BotaoLink, Cabecalho, Carregando, Cartao, Entrada, Etiqueta, Marcador, Selecao, Vazio, useConfirmacao, useToast } from '../../components/ui'
import { EtiquetaTipoVaga, StatusCandidatura } from '../../components/vagas'
import { FormTrocarSenha } from '../../components/TrocarSenha'
import { ESCOLARIDADE, type Conta } from '../../lib/tipos'

type MinhaCandidatura = { id: number; status: string; created_at: string; vaga_id: number; titulo: string; tipo: string; cidade: string; ofertante: string; vaga_status: string }

export function CandidatoPainel() {
  const { usuario } = useCandidato()
  const { dados, carregando, recarregar } = useApi<MinhaCandidatura[]>('/candidato/candidaturas')
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()
  if (!usuario) return null
  const incompleto = !usuario.resumo && !usuario.experiencias && !usuario.curriculo_arquivo

  async function desistir(c: MinhaCandidatura) {
    if (!(await confirmar('Desistir da candidatura', `Retirar sua candidatura à vaga "${c.titulo}"?`, 'Desistir', true))) return
    try { await api(`/candidato/candidaturas/${c.id}/desistir`, { method: 'POST' }); recarregar() } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <div>
      <Cabecalho titulo={`Olá, ${usuario.nome.split(' ')[0]}!`} descricao="Acompanhe suas candidaturas. Você é avisado por WhatsApp e e-mail a cada etapa."
        acoes={<BotaoLink to="/vagas" icone={<Search className="size-4" />}>Ver vagas abertas</BotaoLink>} />
      {incompleto && (
        <div className="mb-5"><Aviso tom="amarelo" titulo="Complete seu currículo" acao={<BotaoLink to="/candidato/perfil" variante="secundario">Completar</BotaoLink>}>
          Sem currículo não é possível se candidatar. Preencha seu resumo e experiências ou envie um PDF.
        </Aviso></div>
      )}
      {usuario.estudante === 1 && usuario.vinculo_status === 'pendente' && (
        <div className="mb-5"><Aviso tom="azul" titulo="Aguardando confirmação da sua instituição de ensino">Quando a instituição confirmar sua matrícula, seu currículo ganha o selo de estudante verificado nas vagas de estágio.</Aviso></div>
      )}
      {carregando && !dados ? <Carregando /> : !dados?.length ? (
        <Vazio icone={<Briefcase />} titulo="Você ainda não se candidatou a nenhuma vaga"><Link to="/vagas" className="font-medium text-siran-700 hover:underline">Veja as vagas abertas</Link></Vazio>
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {dados.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><EtiquetaTipoVaga tipo={c.tipo} />{c.vaga_status !== 'aprovada' && <Etiqueta>Vaga encerrada</Etiqueta>}</div>
                <Link to={`/vagas/${c.vaga_id}`} className="mt-1 block font-medium text-stone-900 hover:underline">{c.titulo}</Link>
                <p className="text-sm text-stone-500">{c.ofertante} · {c.cidade} · enviada em {data(c.created_at)}</p>
              </div>
              <StatusCandidatura status={c.status} />
              {['enviada', 'em_analise'].includes(c.status) && <Botao variante="fantasma" tamanho="sm" onClick={() => desistir(c)}>Desistir</Botao>}
            </div>
          ))}
        </Cartao>
      )}
      {elemento}
    </div>
  )
}

export function CandidatoPerfil() {
  const { usuario, setUsuario } = useCandidato()
  const { dados: instituicoes } = useApi<{ id: number; nome: string; cidade: string | null }[]>('/contas/instituicoes')
  const [d, setD] = useState<Record<string, string>>({})
  const [estudante, setEstudante] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [enviandoPdf, setEnviandoPdf] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!usuario) return
    setD(Object.fromEntries(Object.entries(usuario).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])))
    setD(x => ({ ...x, whatsapp: mascaraTelefone(x.whatsapp || '') }))
    setEstudante(usuario.estudante === 1)
  }, [usuario])
  if (!usuario) return null
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const campos = ['nome', 'whatsapp', 'cidade', 'uf', 'data_nascimento', 'escolaridade', 'areas_interesse', 'resumo', 'experiencias', 'cnh', 'disponibilidade', 'instituicao_id', 'curso', 'periodo', 'matricula', 'previsao_conclusao']
      const r = await api<{ conta: Conta }>('/candidato/perfil', { method: 'PUT', body: {
        ...Object.fromEntries(campos.map(k => [k, d[k] ?? ''])), estudante,
        aceita_whatsapp: d.aceita_whatsapp !== '0', aceita_email: d.aceita_email !== '0',
      } })
      setUsuario(r.conta)
      toast('Currículo salvo.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function enviarPdf(f: File | undefined) {
    if (!f) return
    setEnviandoPdf(true)
    try {
      const form = new FormData()
      form.append('curriculo', f)
      await api('/candidato/curriculo', { method: 'POST', form })
      setUsuario({ ...usuario!, curriculo_arquivo: 'enviado' })
      toast('Currículo em PDF enviado.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviandoPdf(false)
      if (input.current) input.current.value = ''
    }
  }

  async function removerPdf() {
    try { await api('/candidato/curriculo', { method: 'DELETE' }); setUsuario({ ...usuario!, curriculo_arquivo: null }) } catch (e) { toast((e as Error).message, 'erro') }
  }

  const vinculo = usuario.vinculo_status
  return (
    <div className="max-w-3xl space-y-6">
      <Cabecalho titulo="Meu currículo" descricao="Estas informações são mostradas a quem anuncia as vagas em que você se candidatar." />
      <form onSubmit={salvar} className="space-y-6">
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Dados pessoais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="Nome completo" className="sm:col-span-2" value={d.nome || ''} onChange={e => set('nome', e.target.value)} />
            <Entrada rotulo="WhatsApp" value={d.whatsapp || ''} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
            <Entrada rotulo="Data de nascimento" type="date" value={d.data_nascimento || ''} onChange={e => set('data_nascimento', e.target.value)} />
            <Entrada rotulo="Cidade" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} />
            <Selecao rotulo="UF" value={d.uf || 'SP'} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
            <Selecao rotulo="Escolaridade" value={d.escolaridade || ''} onChange={e => set('escolaridade', e.target.value)}>
              <option value="">Selecione…</option>
              {Object.entries(ESCOLARIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
            <Entrada rotulo="CNH" value={d.cnh || ''} onChange={e => set('cnh', e.target.value)} placeholder="Ex.: AB, D, não tenho" />
            <Entrada rotulo="Áreas de interesse" className="sm:col-span-2" value={d.areas_interesse || ''} onChange={e => set('areas_interesse', e.target.value)} placeholder="Pecuária, operação de máquinas, agronomia…" />
            <Entrada rotulo="Disponibilidade" className="sm:col-span-2" value={d.disponibilidade || ''} onChange={e => set('disponibilidade', e.target.value)} placeholder="Imediata, posso morar na fazenda, apenas meio período…" />
          </div>
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Currículo</h2>
          <AreaTexto rotulo="Resumo" value={d.resumo || ''} onChange={e => set('resumo', e.target.value)} rows={3} placeholder="Quem é você profissionalmente, em poucas linhas." />
          <AreaTexto rotulo="Experiências" value={d.experiencias || ''} onChange={e => set('experiencias', e.target.value)} rows={5} placeholder="Onde trabalhou, por quanto tempo e o que fazia." />
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-4 text-sm">
            <FileText className="size-5 text-stone-500" />
            {usuario.curriculo_arquivo ? (
              <>
                <span className="flex-1">Currículo em PDF enviado</span>
                <Botao variante="secundario" tamanho="sm" onClick={() => abrirArquivo('/candidato/curriculo').catch(e => toast(e.message, 'erro'))}>Ver</Botao>
                <Botao variante="fantasma" tamanho="sm" icone={<Trash2 className="size-4" />} onClick={removerPdf}>Remover</Botao>
              </>
            ) : <span className="flex-1 text-stone-600">Tem um currículo pronto? Envie em PDF (opcional, até 5 MB).</span>}
            <Botao variante="claro" tamanho="sm" carregando={enviandoPdf} icone={<Upload className="size-4" />} onClick={() => input.current?.click()}>{usuario.curriculo_arquivo ? 'Trocar PDF' : 'Enviar PDF'}</Botao>
            <input ref={input} type="file" accept="application/pdf" hidden onChange={e => enviarPdf(e.target.files?.[0])} />
          </div>
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Estudante (para vagas de estágio)</h2>
          <Marcador checked={estudante} onChange={setEstudante} rotulo="Sou estudante e quero concorrer a estágios" />
          {estudante && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Selecao rotulo="Instituição de ensino" className="sm:col-span-2" value={d.instituicao_id || ''} onChange={e => set('instituicao_id', e.target.value)}>
                <option value="">Selecione…</option>
                {instituicoes?.map(i => <option key={i.id} value={i.id}>{i.nome}{i.cidade ? ` – ${i.cidade}` : ''}</option>)}
              </Selecao>
              {!instituicoes?.length && <p className="text-sm text-stone-500 sm:col-span-2">Nenhuma instituição parceira cadastrada ainda. Fale com o SIRAN.</p>}
              <Entrada rotulo="Curso" value={d.curso || ''} onChange={e => set('curso', e.target.value)} placeholder="Agronomia, Técnico em agropecuária…" />
              <Entrada rotulo="Período / série" value={d.periodo || ''} onChange={e => set('periodo', e.target.value)} placeholder="6º semestre, 2º ano…" />
              <Entrada rotulo="Número de matrícula (RA)" value={d.matricula || ''} onChange={e => set('matricula', e.target.value)} />
              <Entrada rotulo="Previsão de conclusão" type="month" value={d.previsao_conclusao || ''} onChange={e => set('previsao_conclusao', e.target.value)} />
              <div className="sm:col-span-2">
                {vinculo === 'confirmado' && <Etiqueta tom="verde"><CheckCircle2 className="size-3" /> Matrícula confirmada pela instituição</Etiqueta>}
                {vinculo === 'pendente' && <Etiqueta tom="amarelo">Aguardando confirmação da instituição</Etiqueta>}
                {vinculo === 'recusado' && <Etiqueta tom="vermelho">A instituição não confirmou a matrícula — confira os dados</Etiqueta>}
              </div>
            </div>
          )}
        </Cartao>
        <Cartao className="space-y-2 p-5">
          <h2 className="font-semibold">Avisos</h2>
          <Marcador rotulo="Receber avisos pelo WhatsApp" checked={d.aceita_whatsapp !== '0'} onChange={v => set('aceita_whatsapp', v ? '1' : '0')} />
          <Marcador rotulo="Receber avisos por e-mail" checked={d.aceita_email !== '0'} onChange={v => set('aceita_email', v ? '1' : '0')} />
        </Cartao>
        <Botao type="submit" tamanho="lg" carregando={salvando} icone={<Save className="size-4" />}>Salvar currículo</Botao>
      </form>
      <Cartao className="p-5"><h2 className="mb-4 font-semibold">Trocar senha</h2><div className="max-w-sm"><FormTrocarSenha area="candidato" onConcluir={() => {}} /></div></Cartao>
    </div>
  )
}
