import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, GraduationCap, Hourglass, Lock, MapPin, User, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAssociado } from '../lib/auth'
import { data, mascaraDocumento, mascaraTelefone, cpfValido } from '../lib/format'
import { Aviso, Botao, BotaoLink, Cabecalho, Carregando, Cartao, Entrada, Erro, Marcador, useToast } from './ui'
import { SituacaoCurso, StatusInscricao, periodoCurso } from './cursos'
import type { Curso } from '../lib/tipos'

type Detalhe = Curso & { minha_inscricao: { status: string; codigo: string } | null; associado_logado: boolean }

export default function CursoDetalhe({ voltar }: { voltar: string }) {
  const { id } = useParams()
  const { dados: c, erro, carregando, recarregar } = useApi<Detalhe>(`/cursos/${id}`)
  const { usuario } = useAssociado()
  const [resultado, setResultado] = useState<{ status: string; codigo: string } | null>(null)

  if (carregando && !c) return <Carregando />
  if (erro || !c) return <><Cabecalho titulo="Curso" voltar={voltar} /><Erro mensagem={erro || ''} tentar={recarregar} /></>

  const minha = resultado || c.minha_inscricao
  const info = [
    { icone: CalendarDays, rotulo: 'Data', valor: periodoCurso(c) },
    c.horario && { icone: Clock, rotulo: 'Horário', valor: c.horario },
    c.carga_horaria && { icone: Hourglass, rotulo: 'Carga horária', valor: `${c.carga_horaria} horas` },
    (c.local || c.cidade) && { icone: MapPin, rotulo: 'Local', valor: [c.local, c.cidade].filter(Boolean).join(' – ') },
    c.instrutor && { icone: User, rotulo: 'Instrutor', valor: c.instrutor },
    c.realizacao && { icone: GraduationCap, rotulo: 'Realização', valor: c.realizacao },
    c.vagas !== null && { icone: Users, rotulo: 'Vagas', valor: c.lotado ? `${c.vagas} (lotado)` : `${c.vagas_restantes} de ${c.vagas} disponíveis` },
  ].filter(Boolean) as { icone: typeof CalendarDays; rotulo: string; valor: string }[]

  return (
    <div>
      <Cabecalho titulo={c.titulo} voltar={voltar} descricao={<span className="flex flex-wrap gap-1.5"><SituacaoCurso c={c} />{c.publico === 'associados' && <span className="inline-flex items-center gap-1 text-sm"><Lock className="size-3.5" /> Exclusivo para associados</span>}</span>} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {c.imagem && <img src={c.imagem} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />}
          {c.resumo && <p className="text-lg text-stone-700">{c.resumo}</p>}
          {c.descricao && <Cartao className="p-5"><p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-700">{c.descricao}</p></Cartao>}
          <Cartao className="grid gap-4 p-5 sm:grid-cols-2">
            {info.map(i => (
              <div key={i.rotulo} className="flex gap-3">
                <i.icone className="mt-0.5 size-5 shrink-0 text-siran-600" />
                <div><p className="text-xs uppercase tracking-wide text-stone-500">{i.rotulo}</p><p className="font-medium text-stone-800">{i.valor}</p></div>
              </div>
            ))}
          </Cartao>
        </div>

        <div className="lg:col-span-2">
          <Cartao className="sticky top-24 p-5">
            {minha ? (
              <div className="space-y-3">
                <CheckCircle2 className="size-10 text-siran-600" />
                <StatusInscricao status={minha.status} />
                <p className="text-[15px] text-stone-700">
                  {minha.status === 'espera'
                    ? 'As vagas estão preenchidas e você está na lista de espera. Se abrir vaga, sua inscrição é confirmada automaticamente e você é avisado.'
                    : 'Sua vaga está garantida. Você recebe um lembrete na véspera.'}
                </p>
                <BotaoLink to={`/inscricao/${minha.codigo}`} variante="secundario">Ver ou cancelar inscrição</BotaoLink>
              </div>
            ) : !c.inscricoes_abertas ? (
              <Aviso tom="amarelo" titulo={c.situacao === 'cancelado' ? 'Curso cancelado' : 'Inscrições encerradas'}>
                {c.situacao === 'encerrado' ? 'Este curso já foi realizado.' : 'Fique de olho na agenda para as próximas turmas.'}
              </Aviso>
            ) : usuario?.status === 'ativo' ? (
              <InscricaoAssociado c={c} pj={usuario.tipo_pessoa === 'PJ'} onConcluir={setResultado} />
            ) : c.publico === 'associados' ? (
              <div className="space-y-3">
                <Lock className="size-8 text-siran-600" />
                <p className="font-semibold">Exclusivo para associados do SIRAN</p>
                <p className="text-sm text-stone-600">Entre na Área do Associado para se inscrever com um clique.</p>
                <BotaoLink to="/entrar">Entrar na Área do Associado</BotaoLink>
                <p className="text-sm text-stone-500">Ainda não é associado? <Link to="/associe-se" className="font-medium text-siran-700 hover:underline">Associe-se</Link></p>
              </div>
            ) : (
              <InscricaoPublica c={c} onConcluir={setResultado} />
            )}
          </Cartao>
        </div>
      </div>
    </div>
  )
}

function InscricaoAssociado({ c, pj, onConcluir }: { c: Detalhe; pj: boolean; onConcluir: (r: { status: string; codigo: string }) => void }) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()

  async function inscrever() {
    setEnviando(true)
    try {
      onConcluir(await api(`/cursos/${c.id}/inscricao`, { method: 'POST', body: pj ? { nome, cpf } : {}, area: 'associado' }))
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-semibold text-stone-900">{c.lotado ? 'Entrar na lista de espera' : 'Inscrição para associados'}</p>
      {pj ? (
        <>
          <p className="text-sm text-stone-600">Informe quem da empresa vai participar.</p>
          <Entrada rotulo="Nome do participante" value={nome} onChange={e => setNome(e.target.value)} />
          <Entrada rotulo="CPF do participante" inputMode="numeric" value={cpf} onChange={e => setCpf(mascaraDocumento(e.target.value).slice(0, 14))} />
        </>
      ) : <p className="text-sm text-stone-600">Usamos os dados do seu cadastro. Você recebe a confirmação por WhatsApp e e-mail.</p>}
      <Botao onClick={inscrever} carregando={enviando} tamanho="lg" className="w-full" disabled={pj && (!nome || !cpfValido(cpf))}>
        {c.lotado ? 'Entrar na lista de espera' : 'Inscrever-me'}
      </Botao>
    </div>
  )
}

function InscricaoPublica({ c, onConcluir }: { c: Detalhe; onConcluir: (r: { status: string; codigo: string }) => void }) {
  const [d, setD] = useState({ nome: '', cpf: '', telefone: '', email: '', cidade: '' })
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!cpfValido(d.cpf)) return setErro('Confira o CPF.')
    setEnviando(true)
    try {
      onConcluir(await api(`/cursos/${c.id}/inscricao`, { method: 'POST', body: { ...d, aceite }, area: 'associado' }))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="font-semibold text-stone-900">{c.lotado ? 'Entrar na lista de espera' : 'Faça sua inscrição'}</p>
      <p className="text-sm text-stone-500">É associado? <Link to="/entrar" className="font-medium text-siran-700 hover:underline">Entre</Link> e inscreva-se com um clique.</p>
      <Entrada rotulo="Nome completo" value={d.nome} onChange={e => set('nome', e.target.value)} required autoComplete="name" />
      <Entrada rotulo="CPF" inputMode="numeric" value={d.cpf} onChange={e => set('cpf', mascaraDocumento(e.target.value).slice(0, 14))} required />
      <Entrada rotulo="WhatsApp" inputMode="tel" value={d.telefone} onChange={e => set('telefone', mascaraTelefone(e.target.value))} placeholder="(18) 99999-9999" />
      <Entrada rotulo="E-mail" type="email" value={d.email} onChange={e => set('email', e.target.value)} />
      <Entrada rotulo="Cidade" value={d.cidade} onChange={e => set('cidade', e.target.value)} />
      <Marcador checked={aceite} onChange={setAceite} rotulo="Autorizo o SIRAN a usar meus dados para esta inscrição"
        descricao="Usados para confirmar a vaga, enviar lembretes e emitir a lista de presença, conforme a LGPD." />
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <Botao type="submit" carregando={enviando} tamanho="lg" className="w-full">{c.lotado ? 'Entrar na lista de espera' : 'Confirmar inscrição'}</Botao>
      <p className="text-xs text-stone-400">Inscrições até {data(c.inscricoes_ate || c.data_inicio)}.</p>
    </form>
  )
}
