import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { api, type Area } from '../lib/api'
import { Aviso, Botao, Entrada, useToast } from './ui'

/* Formulário de troca de senha — usado no perfil e como etapa obrigatória após senha provisória */
export function FormTrocarSenha({ area, obrigatoria, onConcluir }: { area: Area; obrigatoria?: boolean; onConcluir: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (nova.length < 8) return setErro('A nova senha precisa ter pelo menos 8 caracteres.')
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.')
    setEnviando(true)
    try {
      await api(area === 'admin' ? '/auth/admin/trocar-senha' : '/auth/trocar-senha', { method: 'POST', area, body: { senha_atual: atual, nova_senha: nova } })
      toast('Senha alterada com sucesso.')
      setAtual(''); setNova(''); setConfirma('')
      onConcluir()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {obrigatoria && (
        <Aviso tom="amarelo" titulo="Crie sua senha pessoal">
          Você entrou com uma senha provisória. Para sua segurança, defina agora uma senha que só você conheça.
        </Aviso>
      )}
      <Entrada rotulo={obrigatoria ? 'Senha provisória' : 'Senha atual'} type="password" autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} required />
      <Entrada rotulo="Nova senha" type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} dica="Mínimo de 8 caracteres." required />
      <Entrada rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={confirma} onChange={e => setConfirma(e.target.value)} required />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <Botao type="submit" carregando={enviando} icone={<KeyRound className="size-4" />}>Salvar nova senha</Botao>
    </form>
  )
}
