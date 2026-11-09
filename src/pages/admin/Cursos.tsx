import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, CalendarDays, Check, Download, ImagePlus, Pencil, Plus, Printer, UserPlus, X } from 'lucide-react'
import { abrirArquivo, api, formData } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { reduzirImagem } from '../../lib/imagem'
import { dataHora, mascaraDocumento, mascaraTelefone, cpfValido } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Cabecalho, Carregando, Cartao, Entrada, Erro, Etiqueta, Modal, Selecao, Vazio, cx, useConfirmacao, useToast } from '../../components/ui'
import { SituacaoCurso, StatusInscricao, periodoCurso } from '../../components/cursos'
import type { Curso, Inscricao } from '../../lib/tipos'

export default function AdmCursos() {
  const [periodo, setPeriodo] = useState('')
  const { dados, erro, carregando, recarregar } = useApi<Curso[]>(`/admin/cursos${periodo ? `?periodo=${periodo}` : ''}`)
  const [editando, setEditando] = useState<Curso | 'novo' | null>(null)

  return (
    <div>
      <Cabecalho titulo="Cursos e eventos" descricao="Agenda publicada no site e na Área do Associado, com inscrição online, vagas e lista de espera."
        acoes={<Botao icone={<Plus className="size-4" />} onClick={() => setEditando('novo')}>Novo curso ou evento</Botao>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {[['', 'Próximos'], ['anteriores', 'Realizados'], ['todos', 'Todos']].map(([k, r]) => (
          <button key={r} onClick={() => setPeriodo(k)} className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', periodo === k ? 'border-siran-900 bg-siran-900 text-white' : 'border-stone-300 bg-white text-stone-700')}>{r}</button>
        ))}
      </div>
      {carregando && !dados ? <Carregando /> : erro ? <Erro mensagem={erro} tentar={recarregar} /> : !dados?.length ? (
        <Vazio icone={<CalendarDays />} titulo="Nenhum curso nesta lista">Cadastre os cursos do SENAR e os eventos do sindicato para abrir as inscrições online.</Vazio>
      ) : (
        <Cartao className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Curso / evento</th><th className="hidden px-4 py-3 font-medium md:table-cell">Cidade</th><th className="px-4 py-3 font-medium">Inscritos</th><th className="px-4 py-3 font-medium">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dados.map(c => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-3">{periodoCurso(c)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/cursos/${c.id}`} className="font-medium text-siran-900 hover:underline">{c.titulo}</Link>
                    <p className="text-xs text-stone-500">{[c.tipo === 'evento' ? 'Evento' : 'Curso', c.categoria, c.publico === 'associados' && 'só associados', c.status === 'rascunho' && 'rascunho'].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.cidade}</td>
                  <td className="px-4 py-3"><b>{c.confirmadas}</b>{c.vagas ? `/${c.vagas}` : ''}{c.em_espera > 0 && <span className="text-amber-700"> +{c.em_espera} espera</span>}</td>
                  <td className="px-4 py-3">{c.status === 'rascunho' ? <Etiqueta>Rascunho</Etiqueta> : <SituacaoCurso c={c} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
      {editando && <FormCurso c={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar() }} />}
    </div>
  )
}

function FormCurso({ c, onFechar, onSalvo }: { c: Curso | null; onFechar: () => void; onSalvo: () => void }) {
  const [d, setD] = useState<Record<string, string>>(() => c
    ? Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]))
    : { tipo: 'curso', publico: 'todos', status: 'publicado', realizacao: 'SIRAN / SENAR' })
  const [imagem, setImagem] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(c?.imagem || null)
  const [removerImagem, setRemoverImagem] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function escolher(f: File | undefined) {
    if (!f) return
    const r = await reduzirImagem(f, 1600, 0.85)
    setImagem(r); setPreview(URL.createObjectURL(r)); setRemoverImagem(false)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const campos = ['tipo', 'titulo', 'resumo', 'descricao', 'categoria', 'realizacao', 'instrutor', 'cidade', 'local', 'data_inicio', 'data_fim', 'horario', 'carga_horaria', 'vagas', 'publico', 'inscricoes_ate', 'status']
      const form = formData({ ...Object.fromEntries(campos.map(k => [k, d[k] ?? ''])), imagem, remover_imagem: removerImagem })
      if (c) {
        const r = await api<{ promovidos: number }>(`/admin/cursos/${c.id}`, { method: 'PUT', form })
        if (r.promovidos) toast(`${r.promovidos} pessoa(s) da lista de espera confirmada(s) e avisada(s).`)
      } else await api('/admin/cursos', { method: 'POST', form })
      onSalvo()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo={c ? 'Editar curso / evento' : 'Novo curso ou evento'} onFechar={onFechar} largura="max-w-2xl"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao type="submit" form="form-curso" carregando={enviando}>Salvar</Botao></>}>
      <form id="form-curso" onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Selecao rotulo="Tipo" value={d.tipo} onChange={e => set('tipo', e.target.value)}><option value="curso">Curso / capacitação</option><option value="evento">Evento</option></Selecao>
          <Selecao rotulo="Quem pode se inscrever" value={d.publico} onChange={e => set('publico', e.target.value)}>
            <option value="todos">Aberto ao público</option><option value="associados">Só associados</option>
          </Selecao>
          <Selecao rotulo="Situação" value={d.status === 'cancelado' ? 'publicado' : d.status} onChange={e => set('status', e.target.value)}>
            <option value="publicado">Publicado</option><option value="rascunho">Rascunho (oculto)</option>
          </Selecao>
        </div>
        <Entrada rotulo="Título" value={d.titulo || ''} onChange={e => set('titulo', e.target.value)} required />
        <Entrada rotulo="Resumo" value={d.resumo || ''} onChange={e => set('resumo', e.target.value)} placeholder="Uma frase sobre o que o participante vai aprender" />
        <AreaTexto rotulo="Descrição / conteúdo" value={d.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={4} placeholder="Conteúdo, público-alvo, o que levar, pré-requisitos…" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Entrada rotulo="Início" type="date" value={d.data_inicio || ''} onChange={e => set('data_inicio', e.target.value)} required />
          <Entrada rotulo="Término" type="date" value={d.data_fim || ''} onChange={e => set('data_fim', e.target.value)} />
          <Entrada rotulo="Inscrições até" type="date" value={d.inscricoes_ate || ''} onChange={e => set('inscricoes_ate', e.target.value)} dica="Em branco: até o início" />
          <Entrada rotulo="Horário" value={d.horario || ''} onChange={e => set('horario', e.target.value)} placeholder="8h às 17h" />
          <Entrada rotulo="Carga horária (h)" inputMode="numeric" value={d.carga_horaria || ''} onChange={e => set('carga_horaria', e.target.value.replace(/\D/g, ''))} />
          <Entrada rotulo="Vagas" inputMode="numeric" value={d.vagas || ''} onChange={e => set('vagas', e.target.value.replace(/\D/g, ''))} dica="Em branco: sem limite" />
          <Entrada rotulo="Cidade" value={d.cidade || ''} onChange={e => set('cidade', e.target.value)} />
          <Entrada rotulo="Local" className="sm:col-span-2" value={d.local || ''} onChange={e => set('local', e.target.value)} placeholder="Casa do SIRAN, sítio, escola…" />
          <Entrada rotulo="Tema" value={d.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder="Agronomia, pecuária…" />
          <Entrada rotulo="Realização" value={d.realizacao || ''} onChange={e => set('realizacao', e.target.value)} />
          <Entrada rotulo="Instrutor" value={d.instrutor || ''} onChange={e => set('instrutor', e.target.value)} />
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => input.current?.click()} className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 hover:border-siran-600">
            {preview && !removerImagem ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-stone-400" />}
          </button>
          <div className="text-sm"><p className="font-medium">Imagem de capa (opcional)</p>{preview && !removerImagem && <button type="button" onClick={() => { setRemoverImagem(true); setImagem(null) }} className="text-red-700 hover:underline">Remover</button>}</div>
          <input ref={input} type="file" accept="image/*" hidden onChange={e => escolher(e.target.files?.[0])} />
        </div>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      </form>
    </Modal>
  )
}

/* ── Inscritos de um curso ── */
export function AdmCursoInscritos() {
  const { id } = useParams()
  const { dados, erro, carregando, recarregar } = useApi<{ curso: Curso; inscritos: Inscricao[] }>(`/admin/cursos/${id}`)
  const [editando, setEditando] = useState(false)
  const [novo, setNovo] = useState(false)
  const toast = useToast()
  const { confirmar, elemento } = useConfirmacao()

  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro || ''} tentar={recarregar} />
  const { curso: c, inscritos } = dados
  const confirmados = inscritos.filter(i => i.status === 'confirmada')
  const espera = inscritos.filter(i => i.status === 'espera')
  const cancelados = inscritos.filter(i => i.status === 'cancelada')

  async function presenca(i: Inscricao, presente: boolean | null) {
    try { await api(`/admin/cursos/inscricoes/${i.id}/presenca`, { method: 'POST', body: { presente } }); recarregar() } catch (e) { toast((e as Error).message, 'erro') }
  }
  async function cancelar(i: Inscricao) {
    if (!(await confirmar('Cancelar inscrição', `Cancelar a inscrição de ${i.nome}? Se houver lista de espera, a próxima pessoa é confirmada e avisada.`, 'Cancelar inscrição', true))) return
    try { const r = await api<{ promovido: boolean }>(`/admin/cursos/inscricoes/${i.id}/cancelar`, { method: 'POST' }); toast(r.promovido ? 'Cancelada — próxima da espera confirmada.' : 'Inscrição cancelada.'); recarregar() } catch (e) { toast((e as Error).message, 'erro') }
  }
  async function cancelarCurso() {
    if (!(await confirmar('Cancelar curso', `Cancelar "${c.titulo}"? Todos os inscritos são avisados por WhatsApp e e-mail.`, 'Cancelar curso', true))) return
    try { const r = await api<{ avisados: number }>(`/admin/cursos/${c.id}/cancelar`, { method: 'POST' }); toast(`Curso cancelado. ${r.avisados} inscrito(s) avisado(s).`); recarregar() } catch (e) { toast((e as Error).message, 'erro') }
  }

  const linha = (i: Inscricao, n: number, classe = '') => (
    <tr key={i.id} className={cx('hover:bg-stone-50', classe)}>
      <td className="px-4 py-3 text-stone-400">{n}</td>
      <td className="px-4 py-3"><p className="font-medium">{i.nome}</p><p className="text-xs text-stone-500">{mascaraDocumento(i.cpf)}{i.matricula ? ` · associado ${i.matricula}` : ''}</p></td>
      <td className="hidden px-4 py-3 md:table-cell">{i.telefone ? mascaraTelefone(i.telefone) : i.email || '—'}<p className="text-xs text-stone-400">{i.cidade}</p></td>
      <td className="hidden px-4 py-3 text-xs text-stone-500 lg:table-cell">{dataHora(i.created_at)}</td>
      <td className="px-4 py-3">
        {i.status === 'confirmada' ? (
          <div className="flex gap-1">
            <button onClick={() => presenca(i, i.presente === 1 ? null : true)} className={cx('rounded-lg p-1.5', i.presente === 1 ? 'bg-siran-600 text-white' : 'border border-stone-300 text-stone-400 hover:text-siran-700')} aria-label="Presente"><Check className="size-4" /></button>
            <button onClick={() => presenca(i, i.presente === 0 ? null : false)} className={cx('rounded-lg p-1.5', i.presente === 0 ? 'bg-red-600 text-white' : 'border border-stone-300 text-stone-400 hover:text-red-700')} aria-label="Faltou"><X className="size-4" /></button>
          </div>
        ) : <StatusInscricao status={i.status} />}
      </td>
      <td className="px-2 py-3 text-right">{i.status !== 'cancelada' && <button onClick={() => cancelar(i)} className="text-xs text-red-700 hover:underline">cancelar</button>}</td>
    </tr>
  )

  return (
    <div>
      <Cabecalho titulo={c.titulo} voltar="/admin/cursos"
        descricao={<span className="flex flex-wrap items-center gap-2"><SituacaoCurso c={c} /> {periodoCurso(c)}{c.cidade ? ` · ${c.cidade}` : ''}</span>}
        acoes={<>
          <Botao variante="secundario" icone={<Pencil className="size-4" />} onClick={() => setEditando(true)}>Editar</Botao>
          <Botao variante="secundario" icone={<UserPlus className="size-4" />} onClick={() => setNovo(true)}>Inscrever</Botao>
          <Botao variante="secundario" icone={<Download className="size-4" />} onClick={() => abrirArquivo(`/admin/cursos/${c.id}/exportar`, 'inscritos.csv', { baixar: true }).catch(e => toast(e.message, 'erro'))}>Planilha</Botao>
          <Botao variante="secundario" icone={<Printer className="size-4" />} onClick={() => window.print()}>Lista de presença</Botao>
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        {[['Confirmados', confirmados.length + (c.vagas ? ` / ${c.vagas}` : '')], ['Lista de espera', espera.length], ['Presentes', confirmados.filter(i => i.presente === 1).length], ['Cancelados', cancelados.length]].map(([r, v]) => (
          <Cartao key={String(r)} className="p-4"><p className="text-sm text-stone-500">{r}</p><p className="text-2xl font-semibold">{v}</p></Cartao>
        ))}
      </div>
      {c.status === 'cancelado' && <div className="mb-4"><Aviso tom="vermelho" titulo="Este curso foi cancelado." /></div>}
      <Cartao className="overflow-x-auto print:border-0">
        <div className="hidden p-4 print:block"><p className="text-lg font-semibold">Lista de presença — {c.titulo}</p><p className="text-sm">{periodoCurso(c)} · {[c.local, c.cidade].filter(Boolean).join(' – ')}</p></div>
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="px-4 py-3 font-medium">#</th><th className="px-4 py-3 font-medium">Participante</th><th className="hidden px-4 py-3 font-medium md:table-cell">Contato</th><th className="hidden px-4 py-3 font-medium lg:table-cell">Inscrição</th><th className="px-4 py-3 font-medium">Presença</th><th className="print:hidden" /></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {confirmados.map((i, n) => linha(i, n + 1))}
            {espera.length > 0 && <tr className="bg-amber-50 print:hidden"><td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase text-amber-800">Lista de espera</td></tr>}
            {espera.map((i, n) => linha(i, n + 1, 'print:hidden'))}
          </tbody>
        </table>
        {!inscritos.length && <p className="p-6 text-center text-sm text-stone-500">Nenhuma inscrição ainda.</p>}
      </Cartao>
      {c.status !== 'cancelado' && <div className="mt-6 print:hidden"><Botao variante="fantasma" className="!text-red-700" icone={<Ban className="size-4" />} onClick={cancelarCurso}>Cancelar este curso</Botao></div>}
      {editando && <FormCurso c={c} onFechar={() => setEditando(false)} onSalvo={() => { setEditando(false); recarregar() }} />}
      {novo && <InscricaoBalcao cursoId={c.id} onFechar={() => setNovo(false)} onFeito={() => { setNovo(false); recarregar() }} />}
      {elemento}
    </div>
  )
}

/* Inscrição feita pela equipe (presencial ou por telefone) — ignora prazo e público */
function InscricaoBalcao({ cursoId, onFechar, onFeito }: { cursoId: number; onFechar: () => void; onFeito: () => void }) {
  const [d, setD] = useState({ nome: '', cpf: '', telefone: '', email: '', cidade: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const toast = useToast()
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))
  useEffect(() => setErro(null), [d])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!cpfValido(d.cpf)) return setErro('CPF inválido.')
    setEnviando(true)
    try {
      const r = await api<{ status: string }>(`/admin/cursos/${cursoId}/inscricoes`, { method: 'POST', body: d })
      toast(r.status === 'espera' ? 'Curso lotado: inscrito na lista de espera.' : 'Inscrição confirmada.')
      onFeito()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal aberto titulo="Inscrever participante" onFechar={onFechar}
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao type="submit" form="form-balcao" carregando={enviando}>Inscrever</Botao></>}>
      <form id="form-balcao" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <p className="text-sm text-stone-600 sm:col-span-2">Para inscrições feitas no balcão ou por telefone. Se o CPF for de um associado, a inscrição fica vinculada ao cadastro dele.</p>
        <Entrada rotulo="Nome completo" className="sm:col-span-2" value={d.nome} onChange={e => set('nome', e.target.value)} required />
        <Entrada rotulo="CPF" value={d.cpf} onChange={e => set('cpf', mascaraDocumento(e.target.value).slice(0, 14))} required />
        <Entrada rotulo="WhatsApp" value={d.telefone} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="E-mail" type="email" value={d.email} onChange={e => set('email', e.target.value)} />
        <Entrada rotulo="Cidade" value={d.cidade} onChange={e => set('cidade', e.target.value)} />
        {erro && <div className="sm:col-span-2"><Aviso tom="vermelho">{erro}</Aviso></div>}
      </form>
    </Modal>
  )
}
