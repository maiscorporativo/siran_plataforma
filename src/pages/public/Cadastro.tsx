import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react'
import PublicoLayout from '../../layouts/PublicoLayout'
import { api, formData } from '../../lib/api'
import { useAssociado } from '../../lib/auth'
import { documentoValido, mascaraDocumento, soDigitos } from '../../lib/format'
import { Aviso, Botao, Entrada, Marcador, cx } from '../../components/ui'
import { CamposContato, CamposEndereco, CamposPropriedade, soEditaveis, type Dados } from '../../components/CamposCadastro'
import { EnvioDocumentos, anexarDocumentos, type DocumentoNovo } from '../../components/EnvioDocumentos'
import type { Associado } from '../../lib/tipos'

const ETAPAS = ['Identificação', 'Contato e endereço', 'Propriedade', 'Documentos e senha']

export default function Cadastro() {
  const { usuario, entrar } = useAssociado()
  const navegar = useNavigate()
  const [etapa, setEtapa] = useState(0)
  const [dados, setDados] = useState<Dados>({ uf: 'SP' })
  const [documentos, setDocumentos] = useState<DocumentoNovo[]>([])
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to="/app" replace />

  const set = (campo: string, valor: string) => setDados(d => ({ ...d, [campo]: valor }))
  const pj = soDigitos(dados.cpf_cnpj).length === 14

  function validarEtapa(): string | null {
    if (etapa === 0) {
      if (!documentoValido(dados.cpf_cnpj || '')) return 'Confira o CPF ou CNPJ.'
      if ((dados.nome || '').trim().split(/\s+/).length < 2) return pj ? 'Informe a razão social.' : 'Informe o nome completo.'
    }
    if (etapa === 1) {
      if (!soDigitos(dados.whatsapp) && !soDigitos(dados.telefone)) return 'Informe um WhatsApp ou telefone.'
      if (!dados.cidade?.trim()) return 'Informe a cidade.'
    }
    return null
  }

  function avancar(e: FormEvent) {
    e.preventDefault()
    const problema = validarEtapa()
    setErro(problema)
    if (!problema) { setEtapa(etapa + 1); window.scrollTo(0, 0) }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirma) return setErro('A confirmação da senha não confere.')
    if (!aceite) return setErro('É preciso aceitar os termos para continuar.')
    setEnviando(true)
    try {
      const f = formData({ ...soEditaveis(dados), nome: dados.nome, cpf_cnpj: dados.cpf_cnpj, senha, aceite_termos: true })
      anexarDocumentos(f, documentos)
      const r = await api<{ token: string; associado: Associado }>('/auth/cadastro', { method: 'POST', form: f, area: 'associado' })
      entrar(r.token, r.associado)
      navegar('/app', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const ultima = etapa === ETAPAS.length - 1

  return (
    <PublicoLayout largo>
      <Link to="/entrar" className="mb-4 inline-flex items-center gap-1 text-sm text-siran-700 hover:underline"><ArrowLeft className="size-4" /> Já sou associado</Link>
      <h1 className="text-2xl font-semibold text-stone-900">Pedido de filiação</h1>
      <p className="mt-1 text-stone-600">Preencha seus dados. A equipe do SIRAN analisa o pedido e libera seu acesso completo.</p>

      {/* Etapas */}
      <ol className="mt-6 flex gap-2">
        {ETAPAS.map((nome, i) => (
          <li key={nome} className="flex-1">
            <div className={cx('h-1.5 rounded-full', i <= etapa ? 'bg-siran-600' : 'bg-stone-200')} />
            <p className={cx('mt-1.5 hidden text-xs sm:block', i === etapa ? 'font-medium text-siran-900' : 'text-stone-500')}>{nome}</p>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-siran-900 sm:hidden">Etapa {etapa + 1} de {ETAPAS.length}: {ETAPAS[etapa]}</p>

      <form onSubmit={ultima ? enviar : avancar} className="mt-6 space-y-5">
        {etapa === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada rotulo="CPF ou CNPJ" className="sm:col-span-2" inputMode="numeric" value={dados.cpf_cnpj || ''}
              onChange={e => set('cpf_cnpj', mascaraDocumento(e.target.value))} required
              erro={dados.cpf_cnpj && soDigitos(dados.cpf_cnpj).length >= 11 && !documentoValido(dados.cpf_cnpj) ? 'Número inválido' : null} />
            <Entrada rotulo={pj ? 'Razão social' : 'Nome completo'} className="sm:col-span-2" value={dados.nome || ''} onChange={e => set('nome', e.target.value)} required autoComplete="name" />
            <Entrada rotulo={pj ? 'Inscrição estadual' : 'RG'} value={dados.rg_ie || ''} onChange={e => set('rg_ie', e.target.value)} />
            {!pj && <Entrada rotulo="Data de nascimento" type="date" value={dados.data_nascimento || ''} onChange={e => set('data_nascimento', e.target.value)} />}
          </div>
        )}
        {etapa === 1 && (
          <>
            <CamposContato dados={dados} set={set} />
            <CamposEndereco dados={dados} set={set} cidadeObrigatoria />
          </>
        )}
        {etapa === 2 && (
          <>
            <p className="text-sm text-stone-600">Dados da propriedade rural principal. Se não tiver algum, pode deixar em branco.</p>
            <CamposPropriedade dados={dados} set={set} />
          </>
        )}
        {etapa === 3 && (
          <>
            <div>
              <p className="mb-1 text-sm font-medium text-stone-700">Documentos</p>
              <p className="mb-3 text-sm text-stone-500">
                Envie foto ou PDF do RG/CNH, comprovante de endereço e, se tiver, inscrição de produtor ou CCIR.
                Isso agiliza a aprovação. Também é possível enviar depois.
              </p>
              <EnvioDocumentos lista={documentos} onChange={setDocumentos} sugestao={documentos.length === 0 ? 'identidade' : documentos.length === 1 ? 'comprovante_endereco' : 'outro'} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Entrada rotulo="Crie uma senha" type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} dica="Mínimo de 8 caracteres." required />
              <Entrada rotulo="Confirme a senha" type="password" autoComplete="new-password" value={confirma} onChange={e => setConfirma(e.target.value)} required />
            </div>
            <Marcador checked={aceite} onChange={setAceite}
              rotulo="Declaro que as informações são verdadeiras e autorizo o SIRAN a tratar meus dados para fins de filiação"
              descricao="Seus dados são usados apenas para a gestão da filiação e dos serviços do sindicato, conforme a LGPD. Documentos ficam acessíveis somente a você e à equipe do SIRAN." />
          </>
        )}

        {erro && <Aviso tom="vermelho">{erro}</Aviso>}

        <div className="flex gap-3">
          {etapa > 0 && <Botao type="button" variante="secundario" onClick={() => { setErro(null); setEtapa(etapa - 1) }} icone={<ArrowLeft className="size-4" />}>Voltar</Botao>}
          <Botao type="submit" className="flex-1" tamanho="lg" carregando={enviando}
            icone={ultima ? <Send className="size-4" /> : undefined}>
            {ultima ? 'Enviar pedido de filiação' : <>Continuar <ArrowRight className="size-4" /></>}
          </Botao>
        </div>
        {ultima && <p className="flex items-center gap-1.5 text-xs text-stone-500"><Check className="size-3.5" /> Você poderá acompanhar a análise entrando com seu CPF/CNPJ e a senha criada.</p>}
      </form>
    </PublicoLayout>
  )
}
