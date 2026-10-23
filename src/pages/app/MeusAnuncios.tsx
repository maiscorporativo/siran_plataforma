import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, ImageOff, Pause, Pencil, Play, Plus, RotateCcw, Store, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { data, preco } from '../../lib/format'
import { Botao, BotaoLink, Cabecalho, Carregando, Cartao, Erro, Vazio, useConfirmacao, useToast } from '../../components/ui'
import { StatusAnuncio } from '../../components/Status'
import type { Classificado } from '../../lib/tipos'

export default function MeusAnuncios() {
  const { dados, erro, carregando, recarregar } = useApi<{ itens: Classificado[] }>('/classificados/meus')
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  async function acao(c: Classificado, nome: string, mensagem: string) {
    try {
      await api(`/classificados/${c.id}/acao`, { method: 'POST', body: { acao: nome } })
      toast(mensagem)
      recarregar()
    } catch (e) { toast((e as Error).message, 'erro') }
  }

  async function excluir(c: Classificado) {
    if (!(await confirmar('Excluir anúncio', <>Excluir <b>{c.titulo}</b>? Essa ação não pode ser desfeita.</>, 'Excluir', true))) return
    try {
      await api(`/classificados/${c.id}`, { method: 'DELETE' })
      toast('Anúncio excluído.')
      recarregar()
    } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <div>
      <Cabecalho titulo="Meus anúncios" voltar="/app/classificados"
        descricao="Todo anúncio novo ou editado passa pela aprovação da equipe do SIRAN antes de ser publicado."
        acoes={<BotaoLink to="/app/classificados/novo" icone={<Plus className="size-4" />}>Novo anúncio</BotaoLink>} />

      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.itens.length ? (
        <Vazio icone={<Store />} titulo="Você ainda não tem anúncios">
          Anuncie máquinas, implementos, animais, produtos ou serviços para os associados.
        </Vazio>
      ) : (
        <div className="space-y-3">
          {dados.itens.map(c => (
            <Cartao key={c.id} className="flex flex-col gap-4 p-4 sm:flex-row">
              <Link to={`/app/classificados/${c.id}`} className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:w-32">
                {c.capa ? <img src={c.capa} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-stone-300"><ImageOff /></div>}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusAnuncio status={c.status_exibido} /></div>
                <Link to={`/app/classificados/${c.id}`} className="mt-1 block font-medium text-stone-900 hover:underline">{c.titulo}</Link>
                <p className="text-sm text-stone-600">{preco(c)} · {c.categoria}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {c.status_exibido === 'aprovado' && <><Eye className="inline size-3.5" /> {c.visualizacoes} visualizações · expira em {data(c.expira_em)}</>}
                  {c.status_exibido === 'pendente' && 'A equipe do sindicato vai revisar em breve.'}
                  {c.status_exibido === 'expirado' && `Expirou em ${data(c.expira_em)}. Renove para voltar à vitrine.`}
                </p>
                {c.status_exibido === 'reprovado' && c.motivo_reprovacao && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Ajuste necessário: {c.motivo_reprovacao}</p>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:w-44 sm:flex-col sm:items-stretch">
                {c.status_exibido !== 'vendido' && <BotaoLink to={`/app/classificados/${c.id}/editar`} variante="secundario" icone={<Pencil className="size-4" />}>Editar</BotaoLink>}
                {c.status_exibido === 'aprovado' && <>
                  <Botao variante="secundario" tamanho="sm" onClick={() => acao(c, 'pausar', 'Anúncio pausado.')} icone={<Pause className="size-4" />}>Pausar</Botao>
                  <Botao variante="secundario" tamanho="sm" onClick={() => acao(c, 'vendido', 'Marcado como vendido. Parabéns!')} icone={<CheckCircle2 className="size-4" />}>Vendido</Botao>
                </>}
                {c.status_exibido === 'pausado' && <Botao variante="claro" tamanho="sm" onClick={() => acao(c, 'reativar', 'Anúncio reativado.')} icone={<Play className="size-4" />}>Reativar</Botao>}
                {c.status_exibido === 'expirado' && <Botao variante="claro" tamanho="sm" onClick={() => acao(c, 'renovar', 'Anúncio renovado.')} icone={<RotateCcw className="size-4" />}>Renovar</Botao>}
                <Botao variante="fantasma" tamanho="sm" className="!text-red-700" onClick={() => excluir(c)} icone={<Trash2 className="size-4" />}>Excluir</Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}
      {elemento}
    </div>
  )
}
