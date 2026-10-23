/* Cliente da API. Associado e equipe têm sessões separadas no navegador. */

export type Area = 'associado' | 'admin'

const CHAVE: Record<Area, string> = { associado: 'siran_token', admin: 'siran_admin_token' }

export const tokens = {
  get(area: Area) {
    try { return localStorage.getItem(CHAVE[area]) } catch { return null }
  },
  set(area: Area, token: string | null) {
    try {
      if (token) localStorage.setItem(CHAVE[area], token)
      else localStorage.removeItem(CHAVE[area])
    } catch { /* navegação privada */ }
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Opcoes = {
  method?: string
  body?: unknown
  form?: FormData
  area?: Area
}

async function requisicao(path: string, { method = 'GET', body, form, area }: Opcoes = {}) {
  const alvo = area ?? (path.startsWith('/admin') ? 'admin' : 'associado')
  const headers: Record<string, string> = {}
  const token = tokens.get(alvo)
  if (token) headers.Authorization = `Bearer ${token}`
  let payload: BodyInit | undefined
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let r: Response
  try {
    r = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Sem conexão com a internet. Verifique o sinal e tente de novo.')
  }
  if (r.status === 401 && token) {
    tokens.set(alvo, null)
    window.dispatchEvent(new CustomEvent('siran:sessao-expirada', { detail: alvo }))
  }
  return r
}

export async function api<T = unknown>(path: string, opcoes: Opcoes = {}): Promise<T> {
  const r = await requisicao(path, opcoes)
  const data = r.headers.get('content-type')?.includes('json') ? await r.json() : null
  if (!r.ok) throw new ApiError(r.status, data?.error || 'Algo deu errado. Tente novamente.')
  return data as T
}

/* Abre um arquivo protegido (PDF de boleto, documento, ofício) usando a sessão atual.
   Com `baixar`, salva direto (ex.: planilhas) em vez de abrir em nova aba. */
export async function abrirArquivo(path: string, nome?: string, { baixar = false } = {}) {
  // Abre a aba já no clique para não ser bloqueada como pop-up
  const aba = baixar ? null : window.open('', '_blank')
  try {
    const r = await requisicao(path)
    if (!r.ok) {
      const data = await r.json().catch(() => null)
      throw new ApiError(r.status, data?.error || 'Arquivo indisponível.')
    }
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    if (aba) aba.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = nome || 'arquivo'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    aba?.close()
    throw err
  }
}

/* Monta FormData a partir de um objeto (ignora null/undefined) */
export function formData(dados: Record<string, unknown>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(dados)) {
    if (v === undefined || v === null) continue
    f.append(k, typeof v === 'boolean' ? String(v) : (v as string | Blob))
  }
  return f
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}
