import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MessageCircle, Send } from 'lucide-react'
import PublicoLayout from '../../layouts/PublicoLayout'
import { api } from '../../lib/api'
import { mascaraDocumento } from '../../lib/format'
import { Aviso, Botao, Entrada } from '../../components/ui'

type Resultado = { enviado: boolean; email?: string | null; whatsapp?: string | null; mensagem?: string }

/* Associado: informa o CPF/CNPJ e recebe o link por e-mail e/ou WhatsApp.
   Serve também como "primeiro acesso" para quem foi importado sem senha. */
export function RecuperarSenhaAssociado() {
  const [documento, setDocumento] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      setResultado(await api<Resultado>('/auth/recuperar', { method: 'POST', body: { documento }, area: 'associado' }))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PublicoLayout>
      <Link to="/entrar" className="mb-4 inline-flex items-center gap-1 text-sm text-siran-700 hover:underline"><ArrowLeft className="size-4" /> Voltar para entrar</Link>
      <h1 className="text-2xl font-semibold text-stone-900">Primeiro acesso ou esqueci a senha</h1>
      <p className="mt-1 text-stone-600">Informe seu CPF ou CNPJ. Enviaremos um link para você criar uma nova senha.</p>

      {resultado?.enviado ? (
        <div className="mt-8 space-y-4">
          <Aviso tom="verde" titulo="Link enviado!">
            <p>Enviamos o link para:</p>
            <ul className="mt-2 space-y-1">
              {resultado.whatsapp && <li className="flex items-center gap-2"><MessageCircle className="size-4" /> WhatsApp {resultado.whatsapp}</li>}
              {resultado.email && <li className="flex items-center gap-2"><Mail className="size-4" /> E-mail {resultado.email}</li>}
            </ul>
            <p className="mt-2">O link vale por 1 hora. Pode levar alguns minutos para chegar.</p>
          </Aviso>
          <p className="text-sm text-stone-600">Não recebeu ou o número/e-mail mudou? Fale com o sindicato para atualizar seu cadastro.</p>
        </div>
      ) : resultado ? (
        <div className="mt-8"><Aviso tom="amarelo" titulo="Não foi possível enviar o link">{resultado.mensagem}</Aviso></div>
      ) : (
        <form onSubmit={enviar} className="mt-8 space-y-4">
          <Entrada rotulo="CPF ou CNPJ" inputMode="numeric" value={documento} onChange={e => setDocumento(mascaraDocumento(e.target.value))} placeholder="000.000.000-00" required />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao type="submit" tamanho="lg" carregando={enviando} className="w-full" icone={<Send className="size-4" />}>Enviar link</Botao>
        </form>
      )}
    </PublicoLayout>
  )
}

/* Equipe: link só por e-mail */
export function RecuperarSenhaAdmin() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState<boolean | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ email_ativo: boolean }>('/auth/admin/recuperar', { method: 'POST', body: { email }, area: 'admin' })
      setEnviado(r.email_ativo)
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
        <h1 className="mt-6 text-center text-lg font-semibold">Recuperar senha da gestão</h1>
        {enviado === null ? (
          <form onSubmit={enviar} className="mt-6 space-y-4">
            <Entrada rotulo="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            {erro && <Aviso tom="vermelho">{erro}</Aviso>}
            <Botao type="submit" className="w-full" carregando={enviando}>Enviar link</Botao>
          </form>
        ) : (
          <div className="mt-6">
            <Aviso tom={enviado ? 'verde' : 'amarelo'}>
              {enviado
                ? 'Se o e-mail pertencer a alguém da equipe, você receberá um link válido por 1 hora.'
                : 'O envio de e-mail não está configurado. Peça ao usuário master para redefinir sua senha em "Equipe".'}
            </Aviso>
          </div>
        )}
        <Link to="/admin/entrar" className="mt-6 block text-center text-sm text-siran-700 hover:underline">Voltar</Link>
      </div>
    </div>
  )
}
