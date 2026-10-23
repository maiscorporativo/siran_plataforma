import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import PublicoLayout from '../../layouts/PublicoLayout'
import { api } from '../../lib/api'
import { useAssociado } from '../../lib/auth'
import { useApi } from '../../lib/useApi'
import { Aviso, Botao, Carregando, Entrada } from '../../components/ui'
import type { Associado } from '../../lib/tipos'

function FormNovaSenha({ onSalvar, textoBotao }: { onSalvar: (senha: string) => Promise<void>; textoBotao: string }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirma) return setErro('A confirmação não confere.')
    setEnviando(true)
    try {
      await onSalvar(senha)
    } catch (err) {
      setErro((err as Error).message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-4">
      <Entrada rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} dica="Mínimo de 8 caracteres." required />
      <Entrada rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={confirma} onChange={e => setConfirma(e.target.value)} required />
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <Botao type="submit" tamanho="lg" className="w-full" carregando={enviando} icone={<KeyRound className="size-4" />}>{textoBotao}</Botao>
    </form>
  )
}

export function RedefinirSenhaAssociado() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''
  const { dados, erro, carregando } = useApi<{ nome: string; primeiro_acesso: boolean }>(token ? `/auth/redefinir/${encodeURIComponent(token)}` : null)
  const { entrar } = useAssociado()
  const navegar = useNavigate()

  async function salvar(nova_senha: string) {
    const r = await api<{ token: string; associado: Associado }>('/auth/redefinir', { method: 'POST', body: { token, nova_senha }, area: 'associado' })
    entrar(r.token, r.associado)
    navegar('/app', { replace: true })
  }

  return (
    <PublicoLayout>
      {carregando ? <Carregando /> : !token || erro || !dados ? (
        <>
          <Aviso tom="amarelo" titulo="Link inválido ou expirado">{erro || 'Peça um novo link.'}</Aviso>
          <Link to="/recuperar-senha" className="mt-4 inline-block font-medium text-siran-700 hover:underline">Pedir novo link</Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-stone-900">{dados.primeiro_acesso ? `Bem-vindo(a), ${dados.nome}!` : `Olá, ${dados.nome}`}</h1>
          <p className="mt-1 text-stone-600">{dados.primeiro_acesso ? 'Crie sua senha para entrar na Área do Associado.' : 'Escolha sua nova senha.'}</p>
          <FormNovaSenha onSalvar={salvar} textoBotao={dados.primeiro_acesso ? 'Criar senha e entrar' : 'Salvar e entrar'} />
        </>
      )}
    </PublicoLayout>
  )
}

export function RedefinirSenhaAdmin() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''
  const [pronto, setPronto] = useState(false)

  async function salvar(nova_senha: string) {
    await api('/auth/admin/redefinir', { method: 'POST', body: { token, nova_senha }, area: 'admin' })
    setPronto(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-siran-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <img src="/logo-siran.png" alt="SIRAN" className="mx-auto h-12" />
        <h1 className="mt-6 text-center text-lg font-semibold">Nova senha da gestão</h1>
        {pronto ? (
          <div className="mt-6 space-y-4">
            <Aviso tom="verde">Senha alterada. Entre com a nova senha.</Aviso>
            <Link to="/admin/entrar" className="block text-center font-medium text-siran-700 hover:underline">Ir para o login</Link>
          </div>
        ) : <FormNovaSenha onSalvar={salvar} textoBotao="Salvar nova senha" />}
      </div>
    </div>
  )
}
