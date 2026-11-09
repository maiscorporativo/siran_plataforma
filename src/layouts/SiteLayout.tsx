import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Briefcase, CalendarDays, LogIn, Menu, X } from 'lucide-react'
import { cx } from '../components/ui'

/* Moldura das páginas abertas ao público: agenda de cursos e mural de vagas */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const local = useLocation()
  useEffect(() => setAberto(false), [local.pathname])

  const links = [
    { to: '/cursos', rotulo: 'Cursos e eventos', icone: CalendarDays },
    { to: '/vagas', rotulo: 'Vagas e estágios', icone: Briefcase },
  ]
  const link = (l: typeof links[number]) => (
    <NavLink key={l.to} to={l.to}
      className={({ isActive }) => cx('flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium',
        isActive ? 'bg-siran-100 text-siran-900' : 'text-stone-600 hover:bg-stone-100')}>
      <l.icone className="size-4" /> {l.rotulo}
    </NavLink>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/cursos" className="shrink-0"><img src="/logo-siran.png" alt="SIRAN" className="h-9" /></Link>
          <nav className="ml-4 hidden gap-1 md:flex">{links.map(link)}</nav>
          <Link to="/entrar" className="ml-auto hidden items-center gap-1.5 rounded-lg bg-siran-900 px-4 py-2 text-sm font-medium text-white hover:bg-siran-800 md:inline-flex">
            <LogIn className="size-4" /> Área do Associado
          </Link>
          <button onClick={() => setAberto(!aberto)} className="ml-auto rounded-lg p-2 hover:bg-stone-100 md:hidden" aria-label="Menu">
            {aberto ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        {aberto && (
          <nav className="space-y-1 border-t border-stone-200 px-4 py-3 md:hidden">
            {links.map(link)}
            <Link to="/entrar" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium text-siran-800"><LogIn className="size-4" /> Área do Associado</Link>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-8">{children}</main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-stone-500">
          <span>SIRAN – Sindicato Rural da Alta Noroeste · Araçatuba-SP</span>
          <span className="flex gap-4">
            <Link to="/empresa/entrar" className="hover:text-siran-700">Empresas</Link>
            <Link to="/instituicao/entrar" className="hover:text-siran-700">Instituições de ensino</Link>
            <Link to="/candidato/entrar" className="hover:text-siran-700">Candidatos</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
