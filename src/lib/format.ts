export const soDigitos = (v: string | null | undefined) => (v || '').replace(/\D/g, '')

export function mascaraDocumento(v: string) {
  const d = soDigitos(v).slice(0, 14)
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export const mascaraCep = (v: string) => soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')

export function cpfValido(v: string) {
  const c = soDigitos(v)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  for (const t of [9, 10]) {
    let s = 0
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i)
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false
  }
  return true
}

export function cnpjValido(v: string) {
  const c = soDigitos(v)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13])
}

export const documentoValido = (v: string) => {
  const d = soDigitos(v)
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false
}

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const moeda = (v: number | null | undefined) => (v === null || v === undefined ? '—' : moedaFmt.format(Number(v)))

export function preco(c: { preco: number | null; preco_tipo: string }) {
  if (c.preco_tipo === 'a_combinar' || c.preco === null) return 'A combinar'
  return moeda(c.preco)
}

/* Datas do banco chegam como "AAAA-MM-DD" ou "AAAA-MM-DD hh:mm:ss" */
export function data(v: string | null | undefined) {
  if (!v) return '—'
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function dataHora(v: string | null | undefined) {
  if (!v) return '—'
  return `${data(v)} ${v.slice(11, 16)}`
}

export function competencia(v: string) {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const [a, m] = v.split('-')
  return `${meses[Number(m) - 1]}/${a}`
}

export function tempoRelativo(v: string | null | undefined) {
  if (!v) return ''
  const dt = new Date(v.replace(' ', 'T'))
  const dias = Math.floor((Date.now() - dt.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return data(v)
}

export function linkWhatsapp(numero: string | null | undefined, mensagem?: string) {
  let d = soDigitos(numero)
  if (!d) return null
  if (d.length <= 11) d = `55${d}`
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`
}

export const linkTelefone = (numero: string | null | undefined) => (numero ? `tel:+55${soDigitos(numero)}` : null)

export function tamanhoArquivo(bytes: number | null | undefined) {
  if (!bytes) return ''
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
