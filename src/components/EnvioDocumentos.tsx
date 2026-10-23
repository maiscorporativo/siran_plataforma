import { useRef } from 'react'
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import { reduzirImagem } from '../lib/imagem'
import { tamanhoArquivo } from '../lib/format'

export const TIPOS_DOCUMENTO: Record<string, string> = {
  identidade: 'RG / CNH',
  cpf_cnpj: 'Cartão CPF / CNPJ',
  comprovante_endereco: 'Comprovante de endereço',
  inscricao_produtor: 'Inscrição de produtor rural',
  ccir: 'CCIR',
  car: 'CAR',
  contrato_social: 'Contrato social',
  itr: 'ITR',
  outro: 'Outro',
}

export type DocumentoNovo = { arquivo: File; tipo: string }

/* Lista de documentos a enviar, cada um com seu tipo. Fotos são reduzidas antes do envio. */
export function EnvioDocumentos({ lista, onChange, sugestao = 'outro' }: { lista: DocumentoNovo[]; onChange: (l: DocumentoNovo[]) => void; sugestao?: string }) {
  const input = useRef<HTMLInputElement>(null)

  async function adicionar(files: FileList | null) {
    if (!files?.length) return
    const novos = await Promise.all(Array.from(files).map(async f => ({ arquivo: await reduzirImagem(f, 2000, 0.85), tipo: sugestao })))
    onChange([...lista, ...novos].slice(0, 10))
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-2">
      {lista.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2 sm:flex-nowrap">
          <FileText className="size-5 shrink-0 text-stone-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{d.arquivo.name}</p>
            <p className="text-xs text-stone-500">{tamanhoArquivo(d.arquivo.size)}</p>
          </div>
          <select value={d.tipo} onChange={e => onChange(lista.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}
            className="campo !w-auto !py-1.5 text-sm" aria-label="Tipo do documento">
            {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={() => onChange(lista.filter((_, j) => j !== i))} className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600" aria-label="Remover">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => input.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 px-4 py-4 text-sm font-medium text-siran-800 hover:border-siran-600 hover:bg-siran-50">
        <Paperclip className="size-4" /> Anexar documento (foto ou PDF)
      </button>
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => adicionar(e.target.files)} />
    </div>
  )
}

export function anexarDocumentos(form: FormData, lista: DocumentoNovo[]) {
  for (const d of lista) {
    form.append('documentos', d.arquivo)
    form.append('tipos_documentos', d.tipo)
  }
}
