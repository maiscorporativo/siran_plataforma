import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokens, type Area } from './api'
import type { Admin, Associado, Conta } from './tipos'

type Sessao<U> = {
  usuario: U | null
  carregando: boolean
  entrar: (token: string, usuario: U) => void
  sair: () => Promise<void>
  atualizar: () => Promise<void>
  setUsuario: (u: U) => void
}

function criarSessao<U>(area: Area, rotaMe: string, chave: string) {
  const Ctx = createContext<Sessao<U> | null>(null)

  function Provider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<U | null>(null)
    const [carregando, setCarregando] = useState(() => !!tokens.get(area))

    const atualizar = useCallback(async () => {
      if (!tokens.get(area)) { setUsuario(null); setCarregando(false); return }
      try {
        const r = await api<Record<string, U>>(rotaMe, { area })
        setUsuario(r[chave])
      } catch {
        setUsuario(null)
      } finally {
        setCarregando(false)
      }
    }, [])

    useEffect(() => { atualizar() }, [atualizar])

    useEffect(() => {
      const fn = (e: Event) => { if ((e as CustomEvent).detail === area) setUsuario(null) }
      window.addEventListener('siran:sessao-expirada', fn)
      return () => window.removeEventListener('siran:sessao-expirada', fn)
    }, [])

    const entrar = (token: string, u: U) => { tokens.set(area, token); setUsuario(u) }
    const sair = async () => {
      try { await api('/auth/logout', { method: 'POST', area }) } catch { /* já expirada */ }
      tokens.set(area, null)
      setUsuario(null)
    }

    return <Ctx.Provider value={{ usuario, carregando, entrar, sair, atualizar, setUsuario }}>{children}</Ctx.Provider>
  }

  function useSessao() {
    const v = useContext(Ctx)
    if (!v) throw new Error('Provider de sessão ausente')
    return v
  }

  return [Provider, useSessao] as const
}

export const [AssociadoProvider, useAssociado] = criarSessao<Associado>('associado', '/auth/me', 'associado')
export const [AdminProvider, useAdmin] = criarSessao<Admin>('admin', '/auth/admin/me', 'admin')
export const [EmpresaProvider, useEmpresa] = criarSessao<Conta>('empresa', '/contas/empresa/me', 'conta')
export const [InstituicaoProvider, useInstituicao] = criarSessao<Conta>('instituicao', '/contas/instituicao/me', 'conta')
export const [CandidatoProvider, useCandidato] = criarSessao<Conta>('candidato', '/contas/candidato/me', 'conta')

export type TipoConta = 'empresa' | 'instituicao' | 'candidato'

/* Sessão de empresa, instituição ou candidato pelo tipo */
export function useConta(tipo: TipoConta) {
  const e = useEmpresa()
  const i = useInstituicao()
  const c = useCandidato()
  return tipo === 'empresa' ? e : tipo === 'instituicao' ? i : c
}

export function ContasProvider({ children }: { children: ReactNode }) {
  return (
    <EmpresaProvider>
      <InstituicaoProvider>
        <CandidatoProvider>{children}</CandidatoProvider>
      </InstituicaoProvider>
    </EmpresaProvider>
  )
}
