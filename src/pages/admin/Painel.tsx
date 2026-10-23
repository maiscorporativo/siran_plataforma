import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, MapPinned, Receipt, RefreshCw, Store, UserPlus, Users } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { useAdmin } from '../../lib/auth'
import { dataHora, moeda } from '../../lib/format'
import { Cabecalho, Carregando, Cartao, Erro, cx } from '../../components/ui'

type Painel = {
  associados: { ativos: number; pendentes: number; vencidos: number; suspensos: number; vencendo: number; aviso_dias: number }
  recredenciamentos_pendentes: number
  anuncios_pendentes: number
  anuncios_publicados: number
  conveniados: number
  financeiro: { boletos_vencidos: number; inadimplentes: number; recebido_mes: number }
  cadastros_recentes: { id: number; nome: string; cidade: string | null; created_at: string }[]
}

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Painel() {
  const { usuario } = useAdmin()
  const { dados: p, erro, carregando, recarregar } = useApi<Painel>('/admin/painel')
  if (carregando && !p) return <Carregando />
  if (erro || !p) return <Erro mensagem={erro || ''} tentar={recarregar} />

  const pendencias = [
    { n: p.associados.pendentes, rotulo: 'pedidos de filiação para analisar', to: '/admin/associados?status=pendente', icone: UserPlus },
    { n: p.recredenciamentos_pendentes, rotulo: 'recredenciamentos aguardando análise', to: '/admin/recredenciamentos', icone: RefreshCw },
    { n: p.anuncios_pendentes, rotulo: 'anúncios aguardando moderação', to: '/admin/classificados', icone: Store },
  ]

  const numeros = [
    { rotulo: 'Associados ativos', valor: p.associados.ativos, to: '/admin/associados?status=ativo', icone: Users },
    { rotulo: `Vencem em ${p.associados.aviso_dias} dias`, valor: p.associados.vencendo, to: '/admin/associados?situacao=renovar', icone: RefreshCw, alerta: p.associados.vencendo > 0 },
    { rotulo: 'Credenciamento vencido', valor: p.associados.vencidos, to: '/admin/associados?situacao=vencido', icone: AlertTriangle, alerta: p.associados.vencidos > 0 },
    { rotulo: 'Inadimplentes', valor: p.financeiro.inadimplentes, to: '/admin/associados?inadimplente=1', icone: Receipt, alerta: p.financeiro.inadimplentes > 0 },
    { rotulo: 'Recebido no mês', valor: moeda(p.financeiro.recebido_mes), to: '/admin/boletos?status=pago', icone: Receipt },
    { rotulo: 'Anúncios publicados', valor: p.anuncios_publicados, to: '/admin/classificados?status=aprovado', icone: Store },
    { rotulo: 'Conveniados ativos', valor: p.conveniados, to: '/admin/conveniados', icone: MapPinned },
  ]

  return (
    <div>
      <Cabecalho titulo={`${saudacao()}, ${usuario?.nome.split(' ')[0]}`} descricao="Resumo das pendências e números do sindicato." />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Pendências</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {pendencias.map(x => (
          <Link key={x.to} to={x.to} className={cx('flex items-center gap-4 rounded-2xl border p-5 transition',
            x.n > 0 ? 'border-amber-300 bg-amber-50 hover:border-amber-400' : 'border-stone-200 bg-white hover:border-siran-600')}>
            <x.icone className={cx('size-7', x.n > 0 ? 'text-amber-700' : 'text-stone-400')} />
            <div className="flex-1">
              <p className="text-3xl font-semibold text-stone-900">{x.n}</p>
              <p className="text-sm text-stone-600">{x.rotulo}</p>
            </div>
            <ArrowRight className="size-5 text-stone-400" />
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">Números</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {numeros.map(x => (
          <Link key={x.rotulo} to={x.to} className="rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-siran-600">
            <x.icone className={cx('size-5', x.alerta ? 'text-red-600' : 'text-siran-600')} />
            <p className="mt-2 text-2xl font-semibold text-stone-900">{x.valor}</p>
            <p className="text-sm text-stone-600">{x.rotulo}</p>
          </Link>
        ))}
      </div>

      {p.cadastros_recentes.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">Pedidos de filiação mais antigos</h2>
          <Cartao className="divide-y divide-stone-100">
            {p.cadastros_recentes.map(a => (
              <Link key={a.id} to={`/admin/associados/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                <div><p className="font-medium">{a.nome}</p><p className="text-sm text-stone-500">{a.cidade}</p></div>
                <p className="text-sm text-stone-500">{dataHora(a.created_at)}</p>
              </Link>
            ))}
          </Cartao>
        </>
      )}
    </div>
  )
}
