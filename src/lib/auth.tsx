import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokens, type Area } from './api'
import type { Admin, Associado } from './tipos'

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
