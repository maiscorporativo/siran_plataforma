import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { useConta, type TipoConta } from '../lib/auth'
import { Aviso, Carregando, cx } from '../components/ui'

type Item = { to: string; rotulo: string; icone: LucideIcon; fim?: boolean }
const ROTULO: Record<TipoConta, string> = { empresa: 'Empresa parceira', instituicao: 'Instituição de ensino', candidato: 'Área do candidato' }

/* Moldura das áreas de empresa parceira, instituição de ensino e candidato */
export default function ContaLayout({ tipo, itens }: { tipo: TipoConta; itens: Item[] }) {
  const { usuario, carregando, sair } = useConta(tipo)
  const [aberto, setAberto] = useState(false)
  const local = useLocation()
  const navegar = useNavigate()
  useEffect(() => { setAberto(false); window.scrollTo(0, 0) }, [local.pathname])

  if (carregando) return <Carregando />
  if (!usuario) return <Navigate to={`/${tipo}/entrar`} replace state={{ de: local.pathname }} />

  async function encerrar() {
    await sair()
    navegar(`/${tipo}/entrar`)
  }

  const link = (i: Item) => (
    <NavLink key={i.to} to={i.to} end={i.fim}
      className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
        isActive ? 'bg-siran-100 text-siran-900' : 'text-stone-600 hover:bg-stone-100')}>
      <i.icone className="size-5" /> {i.rotulo}
    </NavLink>
  )

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/vagas"><img src="/logo-siran.png" alt="SIRAN" className="h-9" /></Link>
          <span className="hidden border-l border-stone-200 pl-3 text-sm text-stone-500 sm:block">{ROTULO[tipo]}</span>
          <div className="ml-auto hidden text-right sm:block">
            <p className="max-w-64 truncate text-sm font-medium text-stone-800">{usuario.nome}</p>
            <p className="text-xs text-stone-500">{usuario.email}</p>
          </div>
          <button onClick={encerrar} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 lg:flex"><LogOut className="size-4" /> Sair</button>
          <button onClick={() => setAberto(!aberto)} className="ml-auto rounded-lg p-2 hover:bg-stone-100 lg:hidden" aria-label="Menu">
            {aberto ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        {aberto && (
          <nav className="space-y-1 border-t border-stone-200 px-4 py-3 lg:hidden">
            {itens.map(link)}
            <button onClick={encerrar} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-red-700"><LogOut className="size-5" /> Sair</button>
          </nav>
        )}
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 lg:py-8">
        <aside className="hidden w-56 shrink-0 lg:block"><nav className="sticky top-24 space-y-1">{itens.map(link)}</nav></aside>
        <main className="min-w-0 flex-1">
          {usuario.status === 'pendente' && (
            <div className="mb-5"><Aviso tom="amarelo" titulo="Cadastro em análise pelo SIRAN">Assim que for aprovado, você recebe um aviso e já pode publicar vagas.</Aviso></div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
