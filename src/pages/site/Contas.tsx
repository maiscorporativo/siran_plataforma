import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, GraduationCap, KeyRound, LogIn, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import { useConta, type TipoConta } from '../../lib/auth'
import { useApi } from '../../lib/useApi'
import { cnpjValido, cpfValido, mascaraDocumento, mascaraTelefone, UFS } from '../../lib/format'
import { AreaTexto, Aviso, Botao, Carregando, Entrada, Marcador, Selecao } from '../../components/ui'
import type { Conta } from '../../lib/tipos'

const PERFIS: Record<TipoConta, { titulo: string; descricao: string; icone: typeof Briefcase; painel: string }> = {
  candidato: { titulo: 'Área do candidato', descricao: 'Cadastre seu currículo e candidate-se a vagas de emprego e estágio no agro.', icone: UserRound, painel: '/candidato' },
  empresa: { titulo: 'Empresas parceiras', descricao: 'Publique vagas de emprego e estágio para profissionais do agro da região.', icone: Briefcase, painel: '/empresa' },
  instituicao: { titulo: 'Instituições de ensino', descricao: 'Confirme a matrícula dos seus estudantes e acompanhe as candidaturas a estágios.', icone: GraduationCap, painel: '/instituicao' },
}

function Moldura({ tipo, children }: { tipo: TipoConta; children: ReactNode }) {
  const p = PERFIS[tipo]
  return (
    <div className="flex min-h-screen items-start justify-center bg-stone-100 px-4 py-10 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <Link to="/vagas" className="mb-5 inline-flex items-center gap-1 text-sm text-siran-700 hover:underline"><ArrowLeft className="size-4" /> Vagas e estágios</Link>
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo-siran.png" alt="SIRAN" className="h-10" />
          <span className="flex items-center gap-1.5 border-l border-stone-200 pl-3 text-sm font-medium text-stone-600"><p.icone className="size-4" /> {p.titulo}</span>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Entrar ── */
export function ContaEntrar({ tipo }: { tipo: TipoConta }) {
  const { usuario, entrar } = useConta(tipo)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  const local = useLocation()
  const destino = (local.state as { de?: string })?.de || PERFIS[tipo].painel
  if (usuario) return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ token: string; conta: Conta }>(`/contas/${tipo}/login`, { method: 'POST', body: { email, senha }, area: tipo })
      entrar(r.token, r.conta)
      navegar(destino, { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura tipo={tipo}>
      <h1 className="text-xl font-semibold text-stone-900">Entrar</h1>
      <p className="mt-1 text-sm text-stone-600">{PERFIS[tipo].descricao}</p>
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <Entrada rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        <Entrada rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" tamanho="lg" className="w-full" carregando={enviando} icone={<LogIn className="size-4" />}>Entrar</Botao>
      </form>
      <div className="mt-5 space-y-2 text-sm">
        <Link to={`/conta/recuperar?tipo=${tipo}`} className="block font-medium text-siran-700 hover:underline">Esqueci a senha</Link>
        {tipo === 'candidato' && <p className="text-stone-600">Ainda não tem conta? <Link to="/candidato/cadastro" className="font-medium text-siran-700 hover:underline">Cadastre seu currículo</Link></p>}
        {tipo === 'empresa' && <>
          <p className="text-stone-600">Empresa ainda não cadastrada? <Link to="/empresa/cadastro" className="font-medium text-siran-700 hover:underline">Solicite seu acesso</Link></p>
          <p className="text-stone-500">É associado do SIRAN? Publique vagas pela <Link to="/entrar" className="font-medium text-siran-700 hover:underline">Área do Associado</Link>.</p>
        </>}
        {tipo === 'instituicao' && <p className="text-stone-500">O acesso das instituições é criado pelo SIRAN. Para participar, fale com o sindicato.</p>}
      </div>
    </Moldura>
  )
}

/* ── Cadastro de candidato ── */
export function CandidatoCadastro() {
  const { usuario, entrar } = useConta('candidato')
  const [d, setD] = useState({ nome: '', cpf: '', email: '', whatsapp: '', cidade: '', uf: 'SP', data_nascimento: '', senha: '' })
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  if (usuario) return <Navigate to="/candidato" replace />
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!cpfValido(d.cpf)) return setErro('Confira o CPF.')
    if (d.senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    setEnviando(true)
    try {
      const r = await api<{ token: string; conta: Conta }>('/contas/candidato/cadastro', { method: 'POST', body: { ...d, aceite }, area: 'candidato' })
      entrar(r.token, r.conta)
      navegar('/candidato/perfil', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura tipo="candidato">
      <h1 className="text-xl font-semibold text-stone-900">Criar conta de candidato</h1>
      <p className="mt-1 text-sm text-stone-600">Depois você completa o currículo e, se for estudante, informa sua instituição de ensino para concorrer a estágios.</p>
      <form onSubmit={enviar} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Entrada rotulo="Nome completo" className="sm:col-span-2" value={d.nome} onChange={e => set('nome', e.target.value)} required autoComplete="name" />
        <Entrada rotulo="CPF" inputMode="numeric" value={d.cpf} onChange={e => set('cpf', mascaraDocumento(e.target.value).slice(0, 14))} required />
        <Entrada rotulo="Data de nascimento" type="date" value={d.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} />
        <Entrada rotulo="E-mail" type="email" className="sm:col-span-2" value={d.email} onChange={e => set('email', e.target.value)} required autoComplete="email" />
        <Entrada rotulo="WhatsApp" inputMode="tel" value={d.whatsapp} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="Cidade" value={d.cidade} onChange={e => set('cidade', e.target.value)} />
        <Entrada rotulo="Crie uma senha" type="password" className="sm:col-span-2" autoComplete="new-password" value={d.senha} onChange={e => set('senha', e.target.value)} dica="Mínimo de 8 caracteres." required />
        <div className="sm:col-span-2">
          <Marcador checked={aceite} onChange={setAceite} rotulo="Autorizo o SIRAN a compartilhar meu currículo com quem anuncia as vagas em que eu me candidatar"
            descricao="Telefone e e-mail só são mostrados ao contratante quando você é chamado para entrevista. Você pode pedir a exclusão dos seus dados a qualquer momento (LGPD)." />
        </div>
        {erro && <div className="sm:col-span-2"><Aviso tom="vermelho">{erro}</Aviso></div>}
        <Botao type="submit" tamanho="lg" className="sm:col-span-2" carregando={enviando}>Criar conta</Botao>
      </form>
      <p className="mt-4 text-sm text-stone-600">Já tem conta? <Link to="/candidato/entrar" className="font-medium text-siran-700 hover:underline">Entrar</Link></p>
    </Moldura>
  )
}

/* ── Cadastro de empresa parceira (aprovado pelo SIRAN) ── */
export function EmpresaCadastro() {
  const { usuario, entrar } = useConta('empresa')
  const [d, setD] = useState({ nome: '', cnpj: '', responsavel: '', cargo: '', email: '', whatsapp: '', telefone: '', cidade: '', uf: 'SP', site: '', descricao: '', senha: '' })
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  if (usuario) return <Navigate to="/empresa" replace />
  const set = (k: string, v: string) => setD(x => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!cnpjValido(d.cnpj)) return setErro('Confira o CNPJ.')
    setEnviando(true)
    try {
      const r = await api<{ token: string; conta: Conta }>('/contas/empresa/cadastro', { method: 'POST', body: { ...d, aceite }, area: 'empresa' })
      entrar(r.token, r.conta)
      navegar('/empresa', { replace: true })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura tipo="empresa">
      <h1 className="text-xl font-semibold text-stone-900">Cadastro de empresa parceira</h1>
      <p className="mt-1 text-sm text-stone-600">Empresas rurais e do agronegócio que não são associadas podem anunciar vagas após aprovação do SIRAN.</p>
      <form onSubmit={enviar} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Entrada rotulo="Razão social / nome da empresa" className="sm:col-span-2" value={d.nome} onChange={e => set('nome', e.target.value)} required />
        <Entrada rotulo="CNPJ" inputMode="numeric" value={d.cnpj} onChange={e => set('cnpj', mascaraDocumento(e.target.value))} required />
        <Entrada rotulo="Site (opcional)" value={d.site} onChange={e => set('site', e.target.value)} />
        <Entrada rotulo="Responsável" value={d.responsavel} onChange={e => set('responsavel', e.target.value)} required />
        <Entrada rotulo="Cargo" value={d.cargo} onChange={e => set('cargo', e.target.value)} placeholder="RH, gerente, proprietário…" />
        <Entrada rotulo="E-mail de acesso" type="email" className="sm:col-span-2" value={d.email} onChange={e => set('email', e.target.value)} required />
        <Entrada rotulo="WhatsApp" inputMode="tel" value={d.whatsapp} onChange={e => set('whatsapp', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="Telefone" inputMode="tel" value={d.telefone} onChange={e => set('telefone', mascaraTelefone(e.target.value))} />
        <Entrada rotulo="Cidade" value={d.cidade} onChange={e => set('cidade', e.target.value)} required />
        <Selecao rotulo="UF" value={d.uf} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</Selecao>
        <AreaTexto rotulo="Sobre a empresa" className="sm:col-span-2" value={d.descricao} onChange={e => set('descricao', e.target.value)} rows={3} placeholder="Atividade, culturas ou criações, porte…" />
        <Entrada rotulo="Crie uma senha" type="password" className="sm:col-span-2" autoComplete="new-password" value={d.senha} onChange={e => set('senha', e.target.value)} dica="Mínimo de 8 caracteres." required />
        <div className="sm:col-span-2"><Marcador checked={aceite} onChange={setAceite} rotulo="Declaro que as informações são verdadeiras e aceito os termos de uso da plataforma" /></div>
        {erro && <div className="sm:col-span-2"><Aviso tom="vermelho">{erro}</Aviso></div>}
        <Botao type="submit" tamanho="lg" className="sm:col-span-2" carregando={enviando}>Solicitar acesso</Botao>
      </form>
    </Moldura>
  )
}

/* ── Recuperar e redefinir senha ── */
export function ContaRecuperar() {
  const [params] = useSearchParams()
  const tipo = (['empresa', 'instituicao', 'candidato'].includes(params.get('tipo') || '') ? params.get('tipo') : 'candidato') as TipoConta
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState<boolean | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await api<{ email_ativo: boolean }>(`/contas/${tipo}/recuperar`, { method: 'POST', body: { email }, area: tipo })
      setEnviado(r.email_ativo)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura tipo={tipo}>
      <h1 className="text-xl font-semibold text-stone-900">Esqueci a senha</h1>
      {enviado === null ? (
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <Entrada rotulo="E-mail cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao type="submit" className="w-full" carregando={enviando}>Enviar link</Botao>
        </form>
      ) : (
        <div className="mt-6">
          <Aviso tom={enviado ? 'verde' : 'amarelo'}>
            {enviado ? 'Se o e-mail estiver cadastrado, você receberá um link válido por 1 hora.' : 'O envio de e-mails ainda não está configurado. Fale com o SIRAN.'}
          </Aviso>
        </div>
      )}
      <Link to={`/${tipo}/entrar`} className="mt-5 block text-sm font-medium text-siran-700 hover:underline">Voltar para entrar</Link>
    </Moldura>
  )
}

export function ContaRedefinir() {
  const [params] = useSearchParams()
  const tipo = (['empresa', 'instituicao', 'candidato'].includes(params.get('tipo') || '') ? params.get('tipo') : 'candidato') as TipoConta
  const token = params.get('t') || ''
  const { dados, erro, carregando } = useApi<{ nome: string; primeiro_acesso: boolean }>(token ? `/contas/${tipo}/redefinir/${encodeURIComponent(token)}` : null)
  const { entrar } = useConta(tipo)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [falha, setFalha] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setFalha(null)
    if (senha.length < 8) return setFalha('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirma) return setFalha('A confirmação não confere.')
    setEnviando(true)
    try {
      const r = await api<{ token: string; conta: Conta }>(`/contas/${tipo}/redefinir`, { method: 'POST', body: { token, nova_senha: senha }, area: tipo })
      entrar(r.token, r.conta)
      navegar(PERFIS[tipo].painel, { replace: true })
    } catch (err) {
      setFalha((err as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Moldura tipo={tipo}>
      {carregando ? <Carregando /> : !token || erro || !dados ? (
        <>
          <Aviso tom="amarelo" titulo="Link inválido ou expirado">{erro || 'Peça um novo link.'}</Aviso>
          <Link to={`/conta/recuperar?tipo=${tipo}`} className="mt-4 inline-block font-medium text-siran-700 hover:underline">Pedir novo link</Link>
        </>
      ) : (
        <form onSubmit={salvar} className="space-y-4">
          <h1 className="text-xl font-semibold text-stone-900">{dados.primeiro_acesso ? `Bem-vindo(a), ${dados.nome}!` : 'Nova senha'}</h1>
          <p className="text-sm text-stone-600">{dados.primeiro_acesso ? 'Crie sua senha para acessar a plataforma.' : 'Escolha sua nova senha.'}</p>
          <Entrada rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} dica="Mínimo de 8 caracteres." required />
          <Entrada rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={confirma} onChange={e => setConfirma(e.target.value)} required />
          {falha && <Aviso tom="vermelho">{falha}</Aviso>}
          <Botao type="submit" tamanho="lg" className="w-full" carregando={enviando} icone={<KeyRound className="size-4" />}>Salvar e entrar</Botao>
        </form>
      )}
    </Moldura>
  )
}
