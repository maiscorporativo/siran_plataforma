import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Mail, MessageCircle, PlugZap, Save, Send, XCircle } from 'lucide-react'
import { api, qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAdmin } from '../../lib/auth'
import { dataHora, mascaraTelefone } from '../../lib/format'
import { Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Etiqueta, cx, useToast } from '../../components/ui'

type Envios = {
  canais: { email: boolean; whatsapp: boolean; remetente: string | null; instancia: string | null; app_url: string | null; fila: { email: number; whatsapp: number } }
  diagnostico: { email: string | null; whatsapp: string | null } | null
  resumo: { enviados: number | null; falhas: number | null; pendentes: number | null }
  log: { id: number; evento: string; canal: 'email' | 'whatsapp'; destino: string; status: string; erro: string | null; created_at: string; nome: string | null }[]
}

const EVENTOS: Record<string, string> = {
  filiacao_aprovada: 'Filiação aprovada', filiacao_recusada: 'Filiação recusada', recuperar_senha: 'Recuperação de senha',
  recuperar_senha_admin: 'Recuperação de senha (equipe)', convite_acesso: 'Link de acesso', recredenciamento_aprovado: 'Recredenciamento aprovado',
  recredenciamento_pendencia: 'Pendência no recredenciamento', recredenciamento_reprovado: 'Recredenciamento reprovado',
  anuncio_aprovado: 'Anúncio aprovado', anuncio_reprovado: 'Anúncio reprovado', boleto_disponivel: 'Boleto disponível',
  lembrete_boleto: 'Lembrete de boleto', comunicado: 'Novo comunicado', teste: 'Teste',
  lembrete_credenciamento_abertura: 'Recredenciamento aberto', lembrete_credenciamento_7dias: 'Credenciamento vence em 7 dias',
  lembrete_credenciamento_vencido: 'Credenciamento vencido', equipe_nova_filiacao: 'Equipe: nova filiação',
  equipe_recredenciamento: 'Equipe: recredenciamento', equipe_anuncio: 'Equipe: anúncio para moderar',
}

export default function Configuracoes() {
  const { usuario } = useAdmin()
  const { dados, carregando } = useApi<Record<string, string>>('/admin/configuracoes')
  const [d, setD] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => { if (dados) setD(dados) }, [dados])
  if (usuario?.papel !== 'master') return <Aviso tom="amarelo">Apenas o usuário master altera as configurações.</Aviso>
  if (carregando && !dados) return <Carregando />

  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      setD(await api('/admin/configuracoes', { method: 'PUT', body: d }))
      toast('Configurações salvas.')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Cabecalho titulo="Configurações" />
      <form onSubmit={salvar} className="space-y-6">
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Credenciamento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="Validade do credenciamento (meses)" inputMode="numeric" value={d.validade_meses || ''} onChange={e => set('validade_meses', e.target.value)}
              dica="Usado na aprovação da filiação e em cada recredenciamento." />
            <Entrada rotulo="Abrir recredenciamento (dias antes)" inputMode="numeric" value={d.aviso_recredenciamento_dias || ''} onChange={e => set('aviso_recredenciamento_dias', e.target.value)}
              dica="O associado é avisado e pode enviar a partir daí." />
          </div>
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Classificados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="Anúncio fica no ar por (dias)" inputMode="numeric" value={d.anuncio_validade_dias || ''} onChange={e => set('anuncio_validade_dias', e.target.value)} />
            <Entrada rotulo="Máximo de fotos por anúncio" inputMode="numeric" value={d.anuncio_max_fotos || ''} onChange={e => set('anuncio_max_fotos', e.target.value)} />
          </div>
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Avisos automáticos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="E-mails da equipe que recebem alertas" className="sm:col-span-2" value={d.notif_equipe_emails || ''} onChange={e => set('notif_equipe_emails', e.target.value)}
              placeholder="secretaria@siran.com.br, presidencia@siran.com.br" dica="Novos pedidos de filiação, recredenciamentos e anúncios para moderar. Separe por vírgula." />
            <Entrada rotulo="Lembrete de boleto (dias antes do vencimento)" inputMode="numeric" value={d.lembrete_boleto_dias || ''} onChange={e => set('lembrete_boleto_dias', e.target.value)}
              dica="0 desliga o lembrete." />
          </div>
        </Cartao>
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Contato do sindicato</h2>
          <p className="text-sm text-stone-500">Exibido para associados na tela de entrada e no menu "Falar com o sindicato".</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="WhatsApp (com DDI e DDD)" value={d.whatsapp_sindicato || ''} onChange={e => set('whatsapp_sindicato', e.target.value.replace(/\D/g, ''))} dica="Ex.: 5518999999999" />
            <Entrada rotulo="Telefone" value={d.telefone_sindicato || ''} onChange={e => set('telefone_sindicato', e.target.value)} />
            <Entrada rotulo="E-mail" className="sm:col-span-2" value={d.email_sindicato || ''} onChange={e => set('email_sindicato', e.target.value)} />
          </div>
        </Cartao>
        <Botao type="submit" carregando={salvando} icone={<Save className="size-4" />}>Salvar configurações</Botao>
      </form>

      <PainelEnvios />
    </div>
  )
}

function Situacao({ ativo, rotulo, detalhe, teste }: { ativo: boolean; rotulo: string; detalhe: string | null; teste: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-4">
      {ativo ? <CheckCircle2 className="size-5 shrink-0 text-siran-600" /> : <XCircle className="size-5 shrink-0 text-stone-400" />}
      <div className="min-w-0 text-sm">
        <p className="font-medium">{rotulo}</p>
        <p className="truncate text-stone-500">{ativo ? detalhe : 'Não configurado'}</p>
        {teste !== undefined && teste !== null && (
          <p className={cx('mt-1 font-medium', teste === 'ok' ? 'text-siran-700' : 'text-red-700')}>{teste === 'ok' ? 'Conexão OK' : teste}</p>
        )}
      </div>
    </div>
  )
}

function PainelEnvios() {
  const [diag, setDiag] = useState(false)
  const { dados, carregando, recarregar } = useApi<Envios>(`/admin/notificacoes${qs({ diagnostico: diag ? 1 : '' })}`)
  const [teste, setTeste] = useState({ email: '', whatsapp: '' })
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()

  async function enviarTeste() {
    setEnviando(true)
    try {
      const r = await api<{ email: string | null; whatsapp: string | null }>('/admin/notificacoes/teste', { method: 'POST', body: teste })
      toast(r.email || r.whatsapp ? 'Teste enviado para a fila. Confira o histórico abaixo em alguns segundos.' : 'Nenhum canal disponível para esse destino.', r.email || r.whatsapp ? 'ok' : 'erro')
      setTimeout(recarregar, 5000)
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando && !dados) return <Carregando />
  if (!dados) return null
  const c = dados.canais

  return (
    <Cartao className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Envios automáticos (e-mail e WhatsApp)</h2>
        <Botao variante="secundario" tamanho="sm" icone={<PlugZap className="size-4" />} carregando={diag && carregando} onClick={() => { setDiag(true); recarregar() }}>Testar conexão</Botao>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Situacao ativo={c.email} rotulo="E-mail (SMTP)" detalhe={c.remetente} teste={dados.diagnostico?.email} />
        <Situacao ativo={c.whatsapp} rotulo="WhatsApp (Evolution API)" detalhe={c.instancia && `Instância ${c.instancia}`} teste={dados.diagnostico?.whatsapp} />
      </div>
      {!c.app_url && <Aviso tom="amarelo" titulo="APP_URL não configurada">Sem ela, os avisos saem sem link e a recuperação de senha fica desativada. Defina APP_URL nas variáveis de ambiente (ex.: https://associado.siran.com.br).</Aviso>}
      {(!c.email || !c.whatsapp) && <p className="text-sm text-stone-500">Os canais são ligados pelas variáveis de ambiente do servidor (SMTP_* e EVOLUTION_*). Veja o README.</p>}

      <div className="flex flex-wrap gap-4 text-sm">
        <span>Últimos 30 dias: <b>{dados.resumo.enviados || 0}</b> enviados</span>
        <span className={dados.resumo.falhas ? 'text-red-700' : ''}><b>{dados.resumo.falhas || 0}</b> falhas</span>
        {(c.fila.email + c.fila.whatsapp) > 0 && <span><b>{c.fila.email + c.fila.whatsapp}</b> na fila agora</span>}
      </div>

      {(c.email || c.whatsapp) && (
        <div className="rounded-xl bg-stone-50 p-4">
          <p className="mb-3 text-sm font-medium">Enviar mensagem de teste</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            {c.email && <Entrada rotulo="E-mail" type="email" value={teste.email} onChange={e => setTeste({ ...teste, email: e.target.value })} />}
            {c.whatsapp && <Entrada rotulo="WhatsApp" value={teste.whatsapp} onChange={e => setTeste({ ...teste, whatsapp: mascaraTelefone(e.target.value) })} placeholder="(18) 99999-9999" />}
            <Botao onClick={enviarTeste} carregando={enviando} disabled={!teste.email && !teste.whatsapp} icone={<Send className="size-4" />}>Enviar</Botao>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Últimos envios</p>
          <button onClick={recarregar} className="text-sm text-siran-700 hover:underline">Atualizar</button>
        </div>
        {dados.log.length === 0 ? <p className="text-sm text-stone-500">Nenhum envio ainda.</p> : (
          <div className="max-h-96 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
            {dados.log.map(l => (
              <div key={l.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                {l.canal === 'email' ? <Mail className="mt-0.5 size-4 shrink-0 text-stone-400" /> : <MessageCircle className="mt-0.5 size-4 shrink-0 text-stone-400" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate"><b>{EVENTOS[l.evento] || l.evento}</b>{l.nome ? ` · ${l.nome}` : ''}</p>
                  <p className="truncate text-xs text-stone-500">{l.canal === 'whatsapp' ? mascaraTelefone(l.destino.replace(/^55/, '')) : l.destino} · {dataHora(l.created_at)}</p>
                  {l.erro && <p className="text-xs text-red-700">{l.erro}</p>}
                </div>
                <Etiqueta tom={l.status === 'enviado' ? 'verde' : l.status === 'falha' ? 'vermelho' : 'amarelo'}>{l.status}</Etiqueta>
              </div>
            ))}
          </div>
        )}
      </div>
    </Cartao>
  )
}
