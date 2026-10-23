import { Link } from 'react-router-dom'
import { ArrowRight, Clock, IdCard, MapPinned, Megaphone, Plus, Receipt, RefreshCw, Store, UserRound } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { data } from '../../lib/format'
import { Aviso, BotaoLink, Carregando, Cartao, Erro, Etiqueta } from '../../components/ui'
import { SeloOrigem } from '../../components/Status'
import { CartaoAnuncio } from '../../components/CartaoAnuncio'
import { TIPO_COMUNICADO, type Associado, type Classificado, type Comunicado } from '../../lib/tipos'

type Resumo = {
  associado: Associado
  boletos: { abertos: number; vencidos: number; proximo_vencimento: string | null }
  recredenciamento: { id: number; status: string; resposta: string | null } | null
  comunicados: Comunicado[]
  comunicados_nao_lidos: number
  classificados: Classificado[]
  meus_anuncios: { publicados: number | null; pendentes: number | null; reprovados: number | null } | null
}

export default function Inicio() {
  const { dados, erro, carregando, recarregar } = useApi<Resumo>('/associado/inicio')
  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro || ''} tentar={recarregar} />

  const a = dados.associado
  const primeiroNome = a.nome.split(' ')[0]

  if (a.status === 'pendente') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">Olá, {primeiroNome}!</h1>
        <Cartao className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700"><Clock className="size-6" /></div>
            <div>
              <h2 className="text-lg font-semibold">Seu pedido de filiação está em análise</h2>
              <p className="mt-1 text-stone-600">
                A equipe do SIRAN vai conferir seus dados e documentos. Assim que for aprovado, você terá acesso à carteirinha,
                aos classificados, ao guia de conveniados e aos comunicados oficiais.
              </p>
              <p className="mt-3 text-sm text-stone-500">Pedido enviado em {data(a.created_at)}.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <BotaoLink to="/app/cadastro" variante="secundario" icone={<UserRound className="size-4" />}>Revisar dados e documentos</BotaoLink>
              </div>
            </div>
          </div>
        </Cartao>
      </div>
    )
  }

  const atalhos = [
    { to: '/app/classificados', rotulo: 'Classificados', icone: Store, cor: 'bg-siran-100 text-siran-900' },
    { to: '/app/conveniados', rotulo: 'Conveniados', icone: MapPinned, cor: 'bg-lima-500/15 text-lima-500' },
    { to: '/app/boletos', rotulo: 'Boletos', icone: Receipt, cor: 'bg-amber-100 text-amber-800' },
    { to: '/app/carteirinha', rotulo: 'Carteirinha', icone: IdCard, cor: 'bg-sky-100 text-sky-800' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Olá, {primeiroNome}!</h1>
        <p className="text-stone-600">Matrícula {a.matricula} · credenciamento válido até {data(a.validade_ate)}</p>
      </div>

      {/* Alertas */}
      <div className="space-y-3 empty:hidden">
        {a.situacao === 'vencido' && (
          <Aviso tom="vermelho" titulo="Seu credenciamento venceu" acao={<BotaoLink to="/app/recredenciamento" variante="perigo">Recredenciar</BotaoLink>}>
            Faça o recredenciamento para continuar com todos os benefícios e poder anunciar nos classificados.
          </Aviso>
        )}
        {a.situacao === 'renovar' && dados.recredenciamento?.status !== 'enviado' && (
          <Aviso tom="amarelo" titulo={`Seu credenciamento vence em ${data(a.validade_ate)}`} acao={<BotaoLink to="/app/recredenciamento" icone={<RefreshCw className="size-4" />}>Recredenciar</BotaoLink>}>
            O recredenciamento já está aberto. Confirme seus dados e envie os documentos atualizados.
          </Aviso>
        )}
        {dados.recredenciamento?.status === 'pendencia' && (
          <Aviso tom="vermelho" titulo="Seu recredenciamento tem uma pendência" acao={<BotaoLink to="/app/recredenciamento" variante="secundario">Ver pendência</BotaoLink>}>
            {dados.recredenciamento.resposta}
          </Aviso>
        )}
        {dados.boletos.vencidos > 0 && (
          <Aviso tom="vermelho" titulo={`Você tem ${dados.boletos.vencidos} mensalidade(s) vencida(s)`} acao={<BotaoLink to="/app/boletos" variante="secundario">Ver boletos</BotaoLink>} />
        )}
        {!!dados.meus_anuncios?.reprovados && (
          <Aviso tom="amarelo" titulo="Um anúncio seu precisa de ajuste" acao={<BotaoLink to="/app/classificados/meus" variante="secundario">Ver anúncios</BotaoLink>} />
        )}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {atalhos.map(t => (
          <Link key={t.to} to={t.to} className="flex flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-siran-600">
            <span className={`rounded-xl p-2.5 ${t.cor}`}><t.icone className="size-6" /></span>
            <span className="font-medium text-stone-800">{t.rotulo}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Comunicados */}
        <Cartao className="p-5 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-stone-900">
              <Megaphone className="size-5 text-siran-700" /> Ofícios e comunicados
              {dados.comunicados_nao_lidos > 0 && <Etiqueta tom="amarelo">{dados.comunicados_nao_lidos} novo(s)</Etiqueta>}
            </h2>
            <Link to="/app/comunicados" className="text-sm font-medium text-siran-700 hover:underline">Ver todos</Link>
          </div>
          {dados.comunicados.length === 0 ? <p className="text-sm text-stone-500">Nenhum comunicado publicado ainda.</p> : (
            <ul className="divide-y divide-stone-100">
              {dados.comunicados.map(c => (
                <li key={c.id}>
                  <Link to={`/app/comunicados/${c.id}`} className="flex items-start gap-3 py-3 hover:bg-stone-50">
                    <SeloOrigem origem={c.origem} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] ${c.lido ? 'text-stone-700' : 'font-semibold text-stone-900'}`}>{c.titulo}</p>
                      <p className="text-xs text-stone-500">{TIPO_COMUNICADO[c.tipo]}{c.numero ? ` · ${c.numero}` : ''} · {data(c.data_publicacao)}</p>
                    </div>
                    {!c.lido && <span className="mt-2 size-2 shrink-0 rounded-full bg-sol-400" aria-label="Não lido" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {/* Financeiro */}
        <Cartao className="p-5 xl:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900"><Receipt className="size-5 text-siran-700" /> Mensalidades</h2>
          {dados.boletos.abertos === 0 ? (
            <p className="text-stone-600">Nenhum boleto em aberto. Tudo em dia! ✅</p>
          ) : (
            <>
              <p className="text-3xl font-semibold text-stone-900">{dados.boletos.abertos}</p>
              <p className="text-sm text-stone-600">boleto(s) em aberto · próximo vencimento {data(dados.boletos.proximo_vencimento)}</p>
              <BotaoLink to="/app/boletos" className="mt-4">Ver e pagar</BotaoLink>
            </>
          )}
        </Cartao>
      </div>

      {/* Classificados recentes */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-stone-900"><Store className="size-5 text-siran-700" /> Novidades nos classificados</h2>
          <div className="flex gap-2">
            <BotaoLink to="/app/classificados/novo" variante="claro" icone={<Plus className="size-4" />}>Anunciar</BotaoLink>
            <BotaoLink to="/app/classificados" variante="fantasma">Ver todos <ArrowRight className="size-4" /></BotaoLink>
          </div>
        </div>
        {dados.classificados.length === 0 ? (
          <Cartao className="p-6 text-center text-stone-600">Ainda não há anúncios. Que tal ser o primeiro a anunciar?</Cartao>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {dados.classificados.map(c => <CartaoAnuncio key={c.id} c={c} />)}
          </div>
        )}
      </section>
    </div>
  )
}
