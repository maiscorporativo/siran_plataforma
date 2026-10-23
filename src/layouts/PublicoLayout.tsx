import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/* Moldura das telas públicas: painel institucional à esquerda (desktop) e formulário à direita */
export default function PublicoLayout({ children, largo }: { children: ReactNode; largo?: boolean }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-siran-950 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-siran-800/60" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-lima-500/20" />
        <img src="/logo-siran-branco.png" alt="SIRAN" className="relative h-14 self-start" />
        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">Tudo do seu sindicato,<br />na palma da mão.</h2>
          <ul className="mt-6 space-y-3 text-siran-100">
            <li>• Carteirinha digital e recredenciamento online</li>
            <li>• Boletos das mensalidades sempre à mão</li>
            <li>• Classificados para negociar entre associados</li>
            <li>• Guia de conveniados com vantagens exclusivas</li>
            <li>• Ofícios e comunicados da FAESP e do SENAR</li>
          </ul>
        </div>
        <p className="relative text-sm text-siran-100/70">Sindicato Rural da Alta Noroeste · Araçatuba-SP</p>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:hidden">
          <Link to="/entrar"><img src="/logo-siran.png" alt="SIRAN" className="h-10" /></Link>
        </div>
        <div className={`mx-auto flex w-full flex-1 flex-col justify-center px-4 pb-10 lg:py-10 ${largo ? 'max-w-2xl' : 'max-w-md'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
