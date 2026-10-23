import {
  createContext, useCallback, useContext, useEffect, useId, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, XCircle } from 'lucide-react'

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(x => typeof x === 'string' && x).join(' ')

/* ── Botão ── */
type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'claro'
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-siran-900 text-white hover:bg-siran-800 shadow-sm',
  secundario: 'bg-white text-siran-900 border border-stone-300 hover:bg-stone-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-siran-800 hover:bg-siran-50',
  claro: 'bg-siran-100 text-siran-900 hover:bg-siran-100/70',
}

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  carregando?: boolean
  icone?: ReactNode
  tamanho?: 'sm' | 'md' | 'lg'
}

export function Botao({ variante = 'primario', carregando, icone, tamanho = 'md', className, children, disabled, ...rest }: BotaoProps) {
  return (
    <button
      {...rest}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-60 disabled:cursor-not-allowed',
        tamanho === 'sm' && 'px-3 py-1.5 text-sm',
        tamanho === 'md' && 'px-4 py-2.5 text-[15px]',
        tamanho === 'lg' && 'px-5 py-3 text-base',
        VARIANTES[variante], className,
      )}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

export function BotaoLink({ to, variante = 'primario', icone, children, className }: { to: string; variante?: Variante; icone?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-medium transition', VARIANTES[variante], className)}>
      {icone}{children}
    </Link>
  )
}

/* ── Campos de formulário ── */
export function Campo({ rotulo, dica, erro, obrigatorio, children, className }: {
  rotulo: string; dica?: ReactNode; erro?: string | null; obrigatorio?: boolean; children: (id: string) => ReactNode; className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {rotulo}{obrigatorio && <span className="text-red-600"> *</span>}
      </label>
      {children(id)}
      {erro ? <p className="mt-1 text-sm text-red-600">{erro}</p> : dica ? <p className="mt-1 text-xs text-stone-500">{dica}</p> : null}
    </div>
  )
}

type ComRotulo = { rotulo: string; dica?: ReactNode; erro?: string | null; className?: string }

export function Entrada({ rotulo, dica, erro, className, ...rest }: ComRotulo & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo rotulo={rotulo} dica={dica} erro={erro} obrigatorio={rest.required} className={className}>
      {id => <input id={id} {...rest} className="campo" />}
    </Campo>
  )
}

export function Selecao({ rotulo, dica, erro, className, children, ...rest }: ComRotulo & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Campo rotulo={rotulo} dica={dica} erro={erro} obrigatorio={rest.required} className={className}>
      {id => <select id={id} {...rest} className="campo">{children}</select>}
    </Campo>
  )
}

export function AreaTexto({ rotulo, dica, erro, className, ...rest }: ComRotulo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Campo rotulo={rotulo} dica={dica} erro={erro} obrigatorio={rest.required} className={className}>
      {id => <textarea id={id} rows={4} {...rest} className="campo" />}
    </Campo>
  )
}

export function Marcador({ rotulo, descricao, checked, onChange }: { rotulo: string; descricao?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-siran-700" />
      <span>
        <span className="block text-sm font-medium text-stone-800">{rotulo}</span>
        {descricao && <span className="block text-xs text-stone-500">{descricao}</span>}
      </span>
    </label>
  )
}

/* ── Estrutura ── */
export function Cartao({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-2xl border border-stone-200 bg-white', className)}>{children}</div>
}

export function Cabecalho({ titulo, descricao, acoes, voltar }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode; voltar?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {voltar && (
          <Link to={voltar} className="mb-2 inline-flex items-center gap-1 text-sm text-siran-700 hover:underline">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
        )}
        <h1 className="text-2xl font-semibold text-stone-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-[15px] text-stone-600">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

const TONS = {
  verde: 'bg-siran-100 text-siran-900',
  amarelo: 'bg-amber-100 text-amber-900',
  vermelho: 'bg-red-100 text-red-800',
  cinza: 'bg-stone-100 text-stone-700',
  azul: 'bg-sky-100 text-sky-900',
}
export type Tom = keyof typeof TONS

export function Etiqueta({ tom = 'cinza', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONS[tom], className)}>{children}</span>
}

export function Aviso({ tom = 'azul', titulo, children, acao }: { tom?: 'azul' | 'amarelo' | 'vermelho' | 'verde'; titulo?: string; children?: ReactNode; acao?: ReactNode }) {
  const estilos = {
    azul: ['border-sky-200 bg-sky-50 text-sky-900', Info],
    amarelo: ['border-amber-200 bg-amber-50 text-amber-900', AlertTriangle],
    vermelho: ['border-red-200 bg-red-50 text-red-900', XCircle],
    verde: ['border-siran-100 bg-siran-50 text-siran-900', CheckCircle2],
  } as const
  const [cls, Icone] = estilos[tom]
  return (
    <div className={cx('flex flex-wrap items-start gap-3 rounded-xl border p-4', cls)}>
      <Icone className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {acao}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-500">
      <Loader2 className="size-5 animate-spin" /> {texto}
    </div>
  )
}

export function Vazio({ icone, titulo, children }: { icone?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      {icone && <div className="mb-3 text-stone-400 [&_svg]:size-10">{icone}</div>}
      <p className="font-medium text-stone-800">{titulo}</p>
      {children && <div className="mt-1 max-w-md text-sm text-stone-500">{children}</div>}
    </div>
  )
}

export function Erro({ mensagem, tentar }: { mensagem: string; tentar?: () => void }) {
  return <Aviso tom="vermelho" titulo="Não foi possível carregar" acao={tentar && <Botao variante="secundario" tamanho="sm" onClick={tentar}>Tentar de novo</Botao>}>{mensagem}</Aviso>
}

export function Paginacao({ pagina, total, porPagina, onChange }: { pagina: number; total: number; porPagina: number; onChange: (p: number) => void }) {
  const paginas = Math.ceil(total / porPagina)
  if (paginas <= 1) return null
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Botao variante="secundario" tamanho="sm" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)} icone={<ChevronLeft className="size-4" />}>Anterior</Botao>
      <span className="text-stone-600">Página {pagina} de {paginas}</span>
      <Botao variante="secundario" tamanho="sm" disabled={pagina >= paginas} onClick={() => onChange(pagina + 1)}>Próxima <ChevronRight className="size-4" /></Botao>
    </div>
  )
}

/* ── Janela modal ── */
export function Modal({ aberto, titulo, onFechar, children, rodape, largura = 'max-w-lg' }: {
  aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode; rodape?: ReactNode; largura?: string
}) {
  useEffect(() => {
    if (!aberto) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = '' }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', largura)}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-stone-500 hover:bg-stone-100" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  )
}

/* ── Avisos rápidos (toast) ── */
type Toast = { id: number; tipo: 'ok' | 'erro'; texto: string }
const ToastCtx = createContext<(texto: string, tipo?: 'ok' | 'erro') => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const mostrar = useCallback((texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random()
    setLista(l => [...l, { id, tipo, texto }])
    setTimeout(() => setLista(l => l.filter(t => t.id !== id)), tipo === 'erro' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {lista.map(t => (
          <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg', t.tipo === 'ok' ? 'bg-siran-900' : 'bg-red-700')}>
            {t.tipo === 'ok' ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* ── Confirmação ── */
export function useConfirmacao() {
  const [estado, setEstado] = useState<{ titulo: string; texto: ReactNode; acao: string; perigo?: boolean; resolver: (v: boolean) => void } | null>(null)
  const confirmar = (titulo: string, texto: ReactNode, acao = 'Confirmar', perigo = false) =>
    new Promise<boolean>(resolver => setEstado({ titulo, texto, acao, perigo, resolver }))
  const fechar = (v: boolean) => { estado?.resolver(v); setEstado(null) }
  const elemento = (
    <Modal aberto={!!estado} titulo={estado?.titulo || ''} onFechar={() => fechar(false)}
      rodape={<>
        <Botao variante="secundario" onClick={() => fechar(false)}>Cancelar</Botao>
        <Botao variante={estado?.perigo ? 'perigo' : 'primario'} onClick={() => fechar(true)}>{estado?.acao}</Botao>
      </>}>
      <div className="text-[15px] text-stone-700">{estado?.texto}</div>
    </Modal>
  )
  return { confirmar, elemento }
}

/* ── Copiar para a área de transferência ── */
export function useCopiar() {
  const toast = useToast()
  return async (texto: string, rotulo = 'Copiado!') => {
    try {
      await navigator.clipboard.writeText(texto)
      toast(rotulo)
    } catch {
      toast('Não foi possível copiar. Selecione e copie manualmente.', 'erro')
    }
  }
}
