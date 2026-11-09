import { useParams } from 'react-router-dom'
import { CalendarDays, MapPin, XCircle } from 'lucide-react'
import SiteLayout from '../../layouts/SiteLayout'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { Aviso, Botao, BotaoLink, Carregando, Cartao, Erro, useConfirmacao, useToast } from '../../components/ui'
import { StatusInscricao, periodoCurso } from '../../components/cursos'

type Dados = {
  nome: string; status: string; curso_id: number; titulo: string; tipo: string; data_inicio: string; data_fim: string | null
  horario: string | null; local: string | null; cidade: string | null; curso_status: string; posicao_espera: number | null
}

/* Página aberta pelo link enviado na confirmação — consulta e cancelamento sem login */
export default function Inscricao() {
  const { codigo } = useParams()
  const { dados: i, erro, carregando, recarregar } = useApi<Dados>(`/cursos/inscricao/${codigo}`)
  const { confirmar, elemento } = useConfirmacao()
  const toast = useToast()

  async function cancelar() {
    if (!(await confirmar('Cancelar inscrição', 'Sua vaga será liberada para a próxima pessoa da lista de espera.', 'Cancelar inscrição', true))) return
    try {
      await api(`/cursos/inscricao/${codigo}/cancelar`, { method: 'POST' })
      toast('Inscrição cancelada.')
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-lg">
        {carregando && !i ? <Carregando /> : erro || !i ? <Erro mensagem={erro || 'Inscrição não encontrada.'} /> : (
          <Cartao className="space-y-4 p-6">
            <p className="text-sm text-stone-500">Inscrição de <b className="text-stone-800">{i.nome}</b></p>
            <h1 className="text-xl font-semibold text-stone-900">{i.titulo}</h1>
            <div className="space-y-1 text-sm text-stone-600">
              <p className="flex items-center gap-2"><CalendarDays className="size-4" /> {periodoCurso(i)}{i.horario ? ` · ${i.horario}` : ''}</p>
              {(i.local || i.cidade) && <p className="flex items-center gap-2"><MapPin className="size-4" /> {[i.local, i.cidade].filter(Boolean).join(' – ')}</p>}
            </div>
            <StatusInscricao status={i.status} />
            {i.curso_status === 'cancelado' && <Aviso tom="vermelho" titulo={`Este ${i.tipo === 'evento' ? 'evento' : 'curso'} foi cancelado pelo sindicato.`} />}
            {i.status === 'espera' && <Aviso tom="amarelo">Você é o {i.posicao_espera}º da lista de espera. Se abrir vaga, sua inscrição é confirmada automaticamente.</Aviso>}
            <div className="flex flex-wrap gap-2 pt-2">
              <BotaoLink to={`/cursos/${i.curso_id}`} variante="secundario">Ver detalhes</BotaoLink>
              {i.status !== 'cancelada' && i.curso_status !== 'cancelado' && (
                <Botao variante="fantasma" className="!text-red-700" icone={<XCircle className="size-4" />} onClick={cancelar}>Cancelar inscrição</Botao>
              )}
            </div>
          </Cartao>
        )}
      </div>
      {elemento}
    </SiteLayout>
  )
}
