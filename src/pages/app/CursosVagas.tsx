import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { AgendaCursos, StatusInscricao, periodoCurso } from '../../components/cursos'
import CursoDetalhe from '../../components/CursoDetalhe'
import { CandidaturasVaga, FormVaga, MinhasVagas } from '../../components/GestaoVagas'
import { Cabecalho, Cartao } from '../../components/ui'

type Minha = { id: number; status: string; codigo: string; curso_id: number; titulo: string; data_inicio: string; data_fim: string | null; cidade: string | null; curso_status: string }

export function CursosAssociado() {
  const { dados: minhas } = useApi<Minha[]>('/cursos/minhas')
  const proximas = (minhas || []).filter(m => (m.data_fim || m.data_inicio) >= new Date().toISOString().slice(0, 10) && m.curso_status !== 'cancelado')
  return (
    <div>
      <Cabecalho titulo="Cursos e eventos" descricao="Capacitações do SIRAN e do SENAR e eventos do sindicato. Como associado, você se inscreve com um clique." />
      {proximas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-stone-900">Minhas inscrições</h2>
          <Cartao className="divide-y divide-stone-100">
            {proximas.map(m => (
              <Link key={m.id} to={`/app/cursos/${m.curso_id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-stone-50">
                <CalendarDays className="size-5 text-siran-600" />
                <div className="min-w-0 flex-1"><p className="font-medium text-stone-900">{m.titulo}</p><p className="text-sm text-stone-500">{periodoCurso(m)}{m.cidade ? ` · ${m.cidade}` : ''}</p></div>
                <StatusInscricao status={m.status} />
              </Link>
            ))}
          </Cartao>
        </section>
      )}
      <AgendaCursos base="/app/cursos" />
    </div>
  )
}

export const CursoAssociado = () => <CursoDetalhe voltar="/app/cursos" />

export function VagasAssociado() {
  return (
    <div>
      <MinhasVagas area="associado" base="/app/vagas" />
      <p className="mt-6 text-sm text-stone-500">
        As vagas aprovadas aparecem no <Link to="/vagas" target="_blank" className="inline-flex items-center gap-1 font-medium text-siran-700 hover:underline">mural público de vagas <ExternalLink className="size-3.5" /></Link>, aberto a candidatos de toda a região.
      </p>
    </div>
  )
}
export const VagaFormAssociado = () => <FormVaga area="associado" base="/app/vagas" />
export const CandidaturasAssociado = () => <CandidaturasVaga area="associado" base="/app/vagas" />
