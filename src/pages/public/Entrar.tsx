import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import PublicoLayout from '../../layouts/PublicoLayout'
import { api } from '../../lib/api'
import { useAssociado } from '../../lib/auth'
import { mascaraDocumento, linkWhatsapp } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { Aviso, Botao, Entrada } from '../../components/ui'
import type { Associado } from '../../lib/tipos'

export default function Entrar() {
  const { usuario, entrar } = useAssociado()
  const [documento, setDocumento] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  const local = useLocation()
  const { dados: contato } = useApi<{ whatsapp: string | null; telefone: string | null }>('/publico/contato')

  if (usuario) return <Navigate to="/app" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ token: string; associado: Associado }>('/auth/login', { method: 'POST', body: { documento, senha }, area: 'associado' })
      entrar(r.token, r.associado)
      navegar((local.state as { de?: string })?.de || '/app', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const whats = linkWhatsapp(contato?.whatsapp, 'Olá! Preciso de ajuda para acessar a Área do Associado.')

  return (
    <PublicoLayout>
      <h1 className="text-2xl font-semibold text-stone-900">Área do Associado</h1>
      <p className="mt-1 text-stone-600">Entre com seu CPF ou CNPJ e senha.</p>

      <form onSubmit={enviar} className="mt-8 space-y-4">
        <Entrada rotulo="CPF ou CNPJ" inputMode="numeric" autoComplete="username" value={documento}
          onChange={e => setDocumento(mascaraDocumento(e.target.value))} placeholder="000.000.000-00" required />
        <Entrada rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" tamanho="lg" carregando={enviando} className="w-full" icone={<LogIn className="size-5" />}>Entrar</Botao>
      </form>

      <div className="mt-6 space-y-3 text-sm text-stone-600">
        <Link to="/recuperar-senha" className="block font-medium text-siran-700 hover:underline">Primeiro acesso ou esqueci a senha</Link>
        <p>
          Precisa de ajuda?{' '}
          {whats
            ? <a href={whats} target="_blank" rel="noreferrer" className="font-medium text-siran-700 hover:underline">Fale com o sindicato</a>
            : 'Fale com o sindicato'}
          {contato?.telefone && <> ou ligue {contato.telefone}</>}.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-siran-100 bg-siran-50 p-5">
        <p className="font-medium text-siran-900">Ainda não é associado?</p>
        <p className="mt-1 text-sm text-stone-600">Faça seu pedido de filiação online. A equipe do SIRAN analisa e libera seu acesso.</p>
        <Link to="/associe-se" className="mt-3 inline-block font-medium text-siran-700 hover:underline">Quero me associar →</Link>
      </div>
    </PublicoLayout>
  )
}
