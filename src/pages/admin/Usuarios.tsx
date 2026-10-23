import { useState, type FormEvent } from 'react'
import { Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAdmin } from '../../lib/auth'
import { dataHora } from '../../lib/format'
import { Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Modal, Selecao, useConfirmacao, useCopiar, useToast } from '../../components/ui'

type Usuario = { id: number; nome: string; email: string; papel: 'master' | 'admin'; ativo: number; ultimo_login: string | null }

export default function Usuarios() {
  const { usuario: eu } = useAdmin()
  const { dados, erro, carregando, recarregar } = useApi<Usuario[]>('/admin/usuarios')
  const [novo, setNovo] = useState(false)
  const [senha, setSenha] = useState<{ email: string; senha: string } | null>(null)
  const toast = useToast()
  const copiar = useCopiar()
  const { confirmar, elemento } = useConfirmacao()

  if (eu?.papel !== 'master') return <Aviso tom="amarelo">Apenas o usuário master gerencia a equipe.</Aviso>

  async function alterar(u: Usuario, mudancas: Partial<Usuario>) {
    try {
      await api(`/admin/usuarios/${u.id}`, { method: 'PUT', body: { ...u, ...mudancas } })
      recarregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  async function redefinir(u: Usuario) {
    if (!(await confirmar('Redefinir senha', `Gerar uma senha provisória para ${u.nome}?`, 'Gerar'))) return
    try {
      const r = await api<{ senha: string }>(`/admin/usuarios/${u.id}/senha-provisoria`, { method: 'POST' })
      setSenha({ email: u.email, senha: r.senha })
    } catch (err) { toast((err as Error).message, 'erro') }
  }

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Equipe" descricao="Quem acessa o painel de gestão do sindicato."
        acoes={<Botao icone={<Plus className="size-4" />} onClick={() => setNovo(true)}>Adicionar pessoa</Botao>} />
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : (
        <Cartao className="divide-y divide-stone-100">
          {dados?.map(u => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.nome} {u.papel === 'master' && <Etiqueta tom="verde"><ShieldCheck className="size-3" /> Master</Etiqueta>} {!u.ativo && <Etiqueta tom="vermelho">Desativado</Etiqueta>}</p>
                <p className="text-sm text-stone-500">{u.email} · último acesso {dataHora(u.ultimo_login)}</p>
              </div>
              {u.id !== eu.id && <>
                <select value={u.papel} onChange={e => alterar(u, { papel: e.target.value as Usuario['papel'] })} className="campo !w-auto !py-1.5 text-sm" aria-label="Papel">
                  <option value="admin">Equipe</option><option value="master">Master</option>
                </select>
                <Botao variante="secundario" tamanho="sm" onClick={() => alterar(u, { ativo: u.ativo ? 0 : 1 })}>{u.ativo ? 'Desativar' : 'Ativar'}</Botao>
                <Botao variante="secundario" tamanho="sm" icone={<KeyRound className="size-4" />} onClick={() => redefinir(u)}>Senha</Botao>
              </>}
            </div>
          ))}
        </Cartao>
      )}
      <p className="mt-3 text-sm text-stone-500"><b>Master</b> também gerencia a equipe e as configurações. <b>Equipe</b> cuida de associados, boletos, anúncios, conveniados e comunicados.</p>

      {novo && <NovoUsuario onFechar={() => setNovo(false)} onCriado={(email, s) => { setNovo(false); setSenha({ email, senha: s }); recarregar() }} />}
      <Modal aberto={!!senha} titulo="Senha provisória" onFechar={() => setSenha(null)}>
        <div className="space-y-3">
          <p className="text-sm text-stone-600">Envie para <b>{senha?.email}</b>. No primeiro acesso em <b>{window.location.origin}/admin</b> será pedida uma nova senha.</p>
          <p className="rounded-xl bg-siran-50 py-4 text-center font-mono text-2xl font-semibold tracking-widest text-siran-900">{senha?.senha}</p>
          <Botao variante="secundario" icone={<Copy className="size-4" />} onClick={() => copiar(senha!.senha, 'Senha copiada!')}>Copiar</Botao>
        </div>
      </Modal>
      {elemento}
    </div>
  )
}

function NovoUsuario({ onFechar, onCriado }: { onFechar: () => void; onCriado: (email: string, senha: string) => void }) {
  const [d, setD] = useState({ nome: '', email: '', papel: 'admin' })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    try {
      const r = await api<{ senha: string }>('/admin/usuarios', { method: 'POST', body: d })
      onCriado(d.email, r.senha)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo="Adicionar pessoa à equipe" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Entrada rotulo="Nome" value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} required />
        <Entrada rotulo="E-mail" type="email" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} required />
        <Selecao rotulo="Papel" value={d.papel} onChange={e => setD({ ...d, papel: e.target.value })}>
          <option value="admin">Equipe</option><option value="master">Master</option>
        </Selecao>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" carregando={enviando} className="w-full">Criar acesso</Botao>
      </form>
    </Modal>
  )
}
