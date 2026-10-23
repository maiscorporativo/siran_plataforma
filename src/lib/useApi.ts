import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

/* Carrega dados de um GET e recarrega quando o caminho muda.
   `caminho = null` deixa a consulta em espera. */
export function useApi<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(!!caminho)
  const atual = useRef(caminho)

  const recarregar = useCallback(async () => {
    if (!caminho) return
    atual.current = caminho
    setCarregando(true)
    setErro(null)
    try {
      const r = await api<T>(caminho)
      if (atual.current === caminho) setDados(r)
    } catch (e) {
      if (atual.current === caminho) setErro((e as Error).message)
    } finally {
      if (atual.current === caminho) setCarregando(false)
    }
  }, [caminho])

  useEffect(() => { recarregar() }, [recarregar])

  return { dados, erro, carregando, recarregar, setDados }
}
