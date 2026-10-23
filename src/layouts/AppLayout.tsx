import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Store, MapPinned, Receipt, Megaphone, IdCard, UserRound, RefreshCw, LogOut, Menu, X, MessageCircle,
} from 'lucide-react'
import { useAssociado } from '../lib/auth'
import { Carregando, cx } from '../components/ui'
import { useApi } from '../lib/useApi'
import { linkWhatsapp } from '../lib/format'
import { FormTrocarSenha } from '../components/TrocarSenha'
import { SituacaoAssociado } from '../components/Status'

type Item = { to: string; rotulo: string; icone: typeof Home; soAtivo?: boolean; fim?: boolean }

const ITENS: Item[] = [
  { to: '/app', rotulo: 'Início', icone: Home, fim: true },
  { to: '/app/classificados', rotulo: 'Classificados', icone: Store, soAtivo: true },
  { to: '/app/conveniados', rotulo: 'Conveniados', icone: MapPinned, soAtivo: true },
  { to: '/app/boletos', rotulo: 'Boletos', icone: Receipt },
  { to: '/app/comunicados', rotulo: 'Ofícios e comunicados', icone: Megaphone, soAtivo: true },
  { to: '/app/carteirinha', rotulo: 'Carteirinha', icone: IdCard, soAtivo: true },
  { to: '/app/recredenciamento', rotulo: 'Recredenciamento', icone: RefreshCw, soAtivo: true },
  { to: '/app/cadastro', rotulo: 'Meu cadastro', icone: UserRound },
]

const BARRA_INFERIOR = ['/app', '/app/classificados', '/app/conveniados', '/app/boletos']

export default function AppLayout() {
  const { usuario, carregando, sair, atualizar } = useAssociado()
  const [menuAberto, setMenuAberto] = useState(false)
  const local = useLocation()
  const navegar = useNavigate()
  const { dados: contato } = useApi<{ whatsapp: string | null }>('/publico/contato')
  const whatsSindicato = linkWhatsapp(contato?.whatsapp, 'Olá! Sou associado e preciso de ajuda.') || undefined

  useEffect(() => { setMenuAberto(false); window.scrollTo(0, 0) }, [local.pathname])

  if (carregando) return <Carregando />
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />

  const ativo = usuario.status === 'ativo'
  const itens = ITENS.filter(i => ativo || !i.soAtivo)

  async function encerrar() {
    await sair()
    navegar('/entrar')
  }

  if (usuario.trocar_senha) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <img src="/logo-siran.png" alt="SIRAN" className="mx-auto mb-8 h-14" />
        <FormTrocarSenha area="associado" obrigatoria onConcluir={atualizar} />
      </div>
    )
  }

  const linkMenu = (i: Item, compacto = false) => (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.fim}
      className={({ isActive }) => cx(
        compacto
          ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium'
          : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
        isActive
          ? (compacto ? 'text-siran-900' : 'bg-siran-100 text-siran-900')
          : (compacto ? 'text-stone-500' : 'text-stone-600 hover:bg-stone-100'),
      )}
    >
      <i.icone className={compacto ? 'size-6' : 'size-5'} />
      {compacto ? i.rotulo.split(' ')[0] : i.rotulo}
    </NavLink>
  )

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link to="/app" className="shrink-0"><img src="/logo-siran.png" alt="SIRAN" className="h-9" /></Link>
          <span className="hidden border-l border-stone-200 pl-3 text-sm text-stone-500 sm:block">Área do Associado</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-56 truncate text-sm font-medium text-stone-800">{usuario.nome}</p>
              <p className="text-xs text-stone-500">{usuario.matricula ? `Matrícula ${usuario.matricula}` : 'Cadastro em análise'}</p>
            </div>
            <button onClick={encerrar} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 lg:flex">
              <LogOut className="size-4" /> Sair
            </button>
            <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 text-stone-700 hover:bg-stone-100 lg:hidden" aria-label="Abrir menu">
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 lg:py-8">
        {/* Menu lateral (desktop) */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            <div className="mb-4 rounded-xl bg-siran-900 p-4 text-white">
              <p className="text-xs text-siran-100/80">Situação</p>
              <div className="mt-1"><SituacaoAssociado situacao={usuario.situacao} /></div>
            </div>
            {itens.map(i => linkMenu(i))}
            <a href={whatsSindicato} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-stone-600 hover:bg-stone-100">
              <MessageCircle className="size-5" /> Falar com o sindicato
            </a>
          </nav>
        </aside>

        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {itens.filter(i => BARRA_INFERIOR.includes(i.to)).map(i => linkMenu(i, true))}
        <button onClick={() => setMenuAberto(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-stone-500">
          <Menu className="size-6" /> Mais
        </button>
      </nav>

      {/* Menu completo (celular) */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuAberto(false)}>
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white p-4" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">{usuario.nome}</p>
                <SituacaoAssociado situacao={usuario.situacao} />
              </div>
              <button onClick={() => setMenuAberto(false)} className="rounded-lg p-2 hover:bg-stone-100" aria-label="Fechar menu"><X className="size-5" /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">{itens.map(i => linkMenu(i))}</nav>
            <a href={whatsSindicato} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-stone-600">
              <MessageCircle className="size-5" /> Falar com o sindicato
            </a>
            <button onClick={encerrar} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-red-700 hover:bg-red-50">
              <LogOut className="size-5" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
