import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useApi } from '../../lib/useApi'
import { data, mascaraDocumento } from '../../lib/format'
import { Aviso, BotaoLink, Cabecalho, Carregando, Erro } from '../../components/ui'
import { SituacaoAssociado } from '../../components/Status'

type Dados = {
  nome: string; matricula: string; cpf_cnpj: string; tipo_pessoa: string; data_filiacao: string | null
  validade_ate: string | null; cidade: string | null; uf: string | null; codigo_validacao: string; situacao: string
}

export default function Carteirinha() {
  const { dados: c, erro, carregando, recarregar } = useApi<Dados>('/associado/carteirinha')
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!c?.codigo_validacao) return
    QRCode.toDataURL(`${window.location.origin}/validar/${c.codigo_validacao}`, { margin: 1, width: 280, color: { dark: '#082a1d' } })
      .then(setQr).catch(() => setQr(null))
  }, [c?.codigo_validacao])

  if (carregando && !c) return <Carregando />
  if (erro || !c) return <Erro mensagem={erro || ''} tentar={recarregar} />

  // Mostra só parte do documento na tela, para quem estiver olhando por cima do ombro
  const doc = mascaraDocumento(c.cpf_cnpj)
  const docParcial = c.tipo_pessoa === 'PF' ? `***.${doc.slice(4, 11)}-**` : doc

  return (
    <div className="mx-auto max-w-md">
      <Cabecalho titulo="Carteirinha digital" descricao="Apresente nos conveniados. O QR Code confirma sua filiação na hora." />

      {c.situacao === 'vencido' && (
        <div className="mb-4"><Aviso tom="vermelho" titulo="Credenciamento vencido" acao={<BotaoLink to="/app/recredenciamento" variante="perigo">Recredenciar</BotaoLink>} /></div>
      )}

      <div className="overflow-hidden rounded-3xl bg-siran-950 text-white shadow-xl">
        <div className="relative overflow-hidden px-6 pb-5 pt-6">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-siran-800/70" />
          <div className="absolute -bottom-20 right-10 size-40 rounded-full bg-lima-500/20" />
          <div className="relative flex items-start justify-between">
            <img src="/logo-siran-branco.png" alt="SIRAN" className="h-10" />
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider">Associado</span>
          </div>
          <div className="relative mt-6">
            <p className="text-xs uppercase tracking-wider text-siran-100/70">Nome</p>
            <p className="text-lg font-semibold leading-tight">{c.nome}</p>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs uppercase tracking-wider text-siran-100/70">Matrícula</p><p className="text-xl font-semibold">{c.matricula}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-siran-100/70">{c.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}</p><p className="font-medium">{docParcial}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-siran-100/70">Associado desde</p><p className="font-medium">{data(c.data_filiacao)}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-siran-100/70">Válida até</p><p className="font-medium">{data(c.validade_ate)}</p></div>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-5 text-stone-800">
          {qr ? <img src={qr} alt="QR Code de validação" className="size-32 shrink-0" /> : <div className="size-32 shrink-0 rounded bg-stone-100" />}
          <div className="text-sm">
            <SituacaoAssociado situacao={c.situacao} />
            <p className="mt-2 text-xs text-stone-500">O conveniado aponta a câmera do celular para conferir a filiação.</p>
            <p className="mt-2 font-mono text-[11px] text-stone-400">{c.codigo_validacao.match(/.{4}/g)?.join(' ')}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-stone-500">Dica: no celular, adicione esta página à tela inicial para abrir a carteirinha rapidinho.</p>
    </div>
  )
}
