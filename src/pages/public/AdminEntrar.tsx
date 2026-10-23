import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdmin } from '../../lib/auth'
import { Aviso, Botao, Entrada } from '../../components/ui'
import type { Admin } from '../../lib/tipos'

export default function AdminEntrar() {
  const { usuario, entrar } = useAdmin()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()

  if (usuario) return <Navigate to="/admin" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ token: string; admin: Admin }>('/auth/admin/login', { method: 'POST', body: { email, senha }, area: 'admin' })
      entrar(r.token, r.admin)
      navegar('/admin', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-siran-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <img src="/logo-siran.png" alt="SIRAN" className="mx-auto h-12" />
        <h1 className="mt-6 text-center text-lg font-semibold text-stone-900">Gestão do sindicato</h1>
        <p className="text-center text-sm text-stone-500">Acesso restrito à equipe do SIRAN</p>
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <Entrada rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
          <Entrada rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao type="submit" className="w-full" carregando={enviando} icone={<ShieldCheck className="size-4" />}>Entrar</Botao>
        </form>
      </div>
    </div>
  )
}
