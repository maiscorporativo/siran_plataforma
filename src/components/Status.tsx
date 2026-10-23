import { Etiqueta, type Tom } from './ui'

const SITUACAO: Record<string, [string, Tom]> = {
  regular: ['Em dia', 'verde'],
  renovar: ['Renovar em breve', 'amarelo'],
  vencido: ['Credenciamento vencido', 'vermelho'],
  ativo: ['Ativo', 'verde'],
  pendente: ['Em análise', 'amarelo'],
  recusado: ['Recusado', 'vermelho'],
  suspenso: ['Suspenso', 'vermelho'],
  inativo: ['Inativo', 'cinza'],
}

export function SituacaoAssociado({ situacao }: { situacao: string }) {
  const [texto, tom] = SITUACAO[situacao] || [situacao, 'cinza']
  return <Etiqueta tom={tom}>{texto}</Etiqueta>
}

const ANUNCIO: Record<string, [string, Tom]> = {
  pendente: ['Aguardando aprovação', 'amarelo'],
  aprovado: ['Publicado', 'verde'],
  reprovado: ['Precisa de ajuste', 'vermelho'],
  pausado: ['Pausado', 'cinza'],
  vendido: ['Vendido / encerrado', 'azul'],
  expirado: ['Expirado', 'cinza'],
}

export function StatusAnuncio({ status }: { status: string }) {
  const [texto, tom] = ANUNCIO[status] || [status, 'cinza']
  return <Etiqueta tom={tom}>{texto}</Etiqueta>
}

export function StatusBoleto({ status, vencido }: { status: string; vencido: number }) {
  if (status === 'pago') return <Etiqueta tom="verde">Pago</Etiqueta>
  if (status === 'cancelado') return <Etiqueta tom="cinza">Cancelado</Etiqueta>
  return vencido ? <Etiqueta tom="vermelho">Vencido</Etiqueta> : <Etiqueta tom="amarelo">Em aberto</Etiqueta>
}

const RECRED: Record<string, [string, Tom]> = {
  enviado: ['Em análise', 'amarelo'],
  pendencia: ['Com pendência', 'vermelho'],
  aprovado: ['Aprovado', 'verde'],
  reprovado: ['Reprovado', 'vermelho'],
}

export function StatusRecredenciamento({ status }: { status: string }) {
  const [texto, tom] = RECRED[status] || [status, 'cinza']
  return <Etiqueta tom={tom}>{texto}</Etiqueta>
}

const ORIGEM_TOM: Record<string, string> = {
  FAESP: 'bg-siran-900 text-white',
  SENAR: 'bg-lima-500 text-white',
  CNA: 'bg-sky-700 text-white',
  SIRAN: 'bg-siran-600 text-white',
  OUTROS: 'bg-stone-500 text-white',
}

export function SeloOrigem({ origem }: { origem: string }) {
  return <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${ORIGEM_TOM[origem] || ORIGEM_TOM.OUTROS}`}>{origem === 'OUTROS' ? 'OUTROS' : origem}</span>
}
