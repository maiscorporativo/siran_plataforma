import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, RefreshCw, Store, MapPinned, Receipt, Megaphone, Tags, ShieldCheck, Settings, LogOut, Menu, X, KeyRound,
} from 'lucide-react'
import { useAdmin } from '../lib/auth'
import { useApi } from '../lib/useApi'
import { Carregando, Modal, cx } from '../components/ui'
import { FormTrocarSenha } from '../components/TrocarSenha'

type Painel = { associados: { pendentes: number }; recredenciamentos_pendentes: number; anuncios_pendentes: number }

export default function AdminLayout() {
  const { usuario, carregando, sair, atualizar } = useAdmin()
  const [menuAberto, setMenuAberto] = useState(false)
  const [trocarSenha, setTrocarSenha] = useState(false)
  const local = useLocation()
  const navegar = useNavigate()
  const { dados: contagem, recarregar } = useApi<Painel>(usuario ? '/admin/painel' : null)

  useEffect(() => { setMenuAberto(false); if (usuario) recarregar() }, [local.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando) return <Carregando />
  if (!usuario) return <Navigate to="/admin/entrar" replace />

  if (usuario.trocar_senha) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <img src="/logo-siran.png" alt="SIRAN" className="mx-auto mb-8 h-14" />
        <FormTrocarSenha area="admin" obrigatoria onConcluir={atualizar} />
      </div>
    )
  }

  const itens = [
    { to: '/admin', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
    { to: '/admin/associados', rotulo: 'Associados', icone: Users, badge: contagem?.associados.pendentes },
    { to: '/admin/recredenciamentos', rotulo: 'Recredenciamentos', icone: RefreshCw, badge: contagem?.recredenciamentos_pendentes },
    { to: '/admin/classificados', rotulo: 'Classificados', icone: Store, badge: contagem?.anuncios_pendentes },
    { to: '/admin/conveniados', rotulo: 'Conveniados', icone: MapPinned },
    { to: '/admin/boletos', rotulo: 'Boletos', icone: Receipt },
    { to: '/admin/comunicados', rotulo: 'Ofícios e comunicados', icone: Megaphone },
    { to: '/admin/categorias', rotulo: 'Categorias', icone: Tags },
    ...(usuario.papel === 'master' ? [
      { to: '/admin/usuarios', rotulo: 'Equipe', icone: ShieldCheck },
      { to: '/admin/configuracoes', rotulo: 'Configurações', icone: Settings },
    ] : []),
  ]

  async function encerrar() {
    await sair()
    navegar('/admin/entrar')
  }

  const menu = (
    <nav className="flex h-full flex-col">
      <div className="mb-6 px-2">
        <img src="/logo-siran-branco.png" alt="SIRAN" className="h-10" />
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-siran-100/70">Gestão do sindicato</p>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {itens.map(i => (
          <NavLink key={i.to} to={i.to} end={i.fim}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-white/15 text-white' : 'text-siran-100/85 hover:bg-white/10 hover:text-white')}>
            <i.icone className="size-[18px]" />
            <span className="flex-1">{i.rotulo}</span>
            {!!i.badge && <span className="rounded-full bg-sol-400 px-2 py-0.5 text-xs font-semibold text-siran-950">{i.badge}</span>}
          </NavLink>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="truncate px-3 text-sm font-medium text-white">{usuario.nome}</p>
        <p className="truncate px-3 text-xs text-siran-100/70">{usuario.email}</p>
        <button onClick={() => setTrocarSenha(true)} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-siran-100/85 hover:bg-white/10">
          <KeyRound className="size-[18px]" /> Trocar senha
        </button>
        <button onClick={encerrar} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-siran-100/85 hover:bg-white/10">
          <LogOut className="size-[18px]" /> Sair
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-siran-950 p-4 lg:block">{menu}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:hidden">
        <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 hover:bg-stone-100" aria-label="Abrir menu"><Menu className="size-5" /></button>
        <img src="/logo-siran.png" alt="SIRAN" className="h-7" />
        <span className="text-sm text-stone-500">Gestão</span>
      </header>
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuAberto(false)}>
          <aside className="absolute inset-y-0 left-0 w-72 bg-siran-950 p-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuAberto(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-white hover:bg-white/10" aria-label="Fechar menu"><X className="size-5" /></button>
            {menu}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8"><Outlet context={{ recarregarContagem: recarregar }} /></main>

      <Modal aberto={trocarSenha} titulo="Trocar senha" onFechar={() => setTrocarSenha(false)}>
        <FormTrocarSenha area="admin" onConcluir={() => setTrocarSenha(false)} />
      </Modal>
    </div>
  )
}
