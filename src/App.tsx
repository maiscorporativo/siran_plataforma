import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminProvider, AssociadoProvider, ContasProvider } from './lib/auth'
import { Carregando, ToastProvider } from './components/ui'
import AppLayout from './layouts/AppLayout'
import AdminLayout from './layouts/AdminLayout'
import ContaLayout from './layouts/ContaLayout'
import { Briefcase, Building2, FileUser, GraduationCap, Plus, Search, Users } from 'lucide-react'
import Entrar from './pages/public/Entrar'

const Cadastro = lazy(() => import('./pages/public/Cadastro'))
const Validar = lazy(() => import('./pages/public/Validar'))
const AdminEntrar = lazy(() => import('./pages/public/AdminEntrar'))
const RecuperarAssociado = lazy(() => import('./pages/public/RecuperarSenha').then(m => ({ default: m.RecuperarSenhaAssociado })))
const RecuperarAdmin = lazy(() => import('./pages/public/RecuperarSenha').then(m => ({ default: m.RecuperarSenhaAdmin })))
const RedefinirAssociado = lazy(() => import('./pages/public/RedefinirSenha').then(m => ({ default: m.RedefinirSenhaAssociado })))
const RedefinirAdmin = lazy(() => import('./pages/public/RedefinirSenha').then(m => ({ default: m.RedefinirSenhaAdmin })))

const Inicio = lazy(() => import('./pages/app/Inicio'))
const Classificados = lazy(() => import('./pages/app/Classificados'))
const ClassificadoDetalhe = lazy(() => import('./pages/app/ClassificadoDetalhe'))
const MeusAnuncios = lazy(() => import('./pages/app/MeusAnuncios'))
const AnuncioForm = lazy(() => import('./pages/app/AnuncioForm'))
const Conveniados = lazy(() => import('./pages/app/Conveniados'))
const Boletos = lazy(() => import('./pages/app/Boletos'))
const Comunicados = lazy(() => import('./pages/app/Comunicados'))
const ComunicadoDetalhe = lazy(() => import('./pages/app/ComunicadoDetalhe'))
const Carteirinha = lazy(() => import('./pages/app/Carteirinha'))
const Recredenciamento = lazy(() => import('./pages/app/Recredenciamento'))
const MeuCadastro = lazy(() => import('./pages/app/MeuCadastro'))

const Painel = lazy(() => import('./pages/admin/Painel'))
const AdmAssociados = lazy(() => import('./pages/admin/Associados'))
const AdmAssociadoFicha = lazy(() => import('./pages/admin/AssociadoFicha'))
const AdmRecredenciamentos = lazy(() => import('./pages/admin/Recredenciamentos'))
const AdmClassificados = lazy(() => import('./pages/admin/Classificados'))
const AdmConveniados = lazy(() => import('./pages/admin/Conveniados'))
const AdmBoletos = lazy(() => import('./pages/admin/Boletos'))
const AdmComunicados = lazy(() => import('./pages/admin/Comunicados'))
const AdmCategorias = lazy(() => import('./pages/admin/Categorias'))
const AdmUsuarios = lazy(() => import('./pages/admin/Usuarios'))
const AdmConfiguracoes = lazy(() => import('./pages/admin/Configuracoes'))
const AdmCursos = lazy(() => import('./pages/admin/Cursos'))
const AdmCursoInscritos = lazy(() => import('./pages/admin/Cursos').then(m => ({ default: m.AdmCursoInscritos })))
const AdmVagas = lazy(() => import('./pages/admin/Vagas').then(m => ({ default: m.AdmVagas })))
const AdmOrganizacoes = lazy(() => import('./pages/admin/Vagas').then(m => ({ default: m.AdmOrganizacoes })))
const AdmCandidatos = lazy(() => import('./pages/admin/Vagas').then(m => ({ default: m.AdmCandidatos })))

// Site público: agenda de cursos e mural de vagas
const CursosPublico = lazy(() => import('./pages/site/Cursos').then(m => ({ default: m.CursosPublico })))
const CursoPublico = lazy(() => import('./pages/site/Cursos').then(m => ({ default: m.CursoPublico })))
const Inscricao = lazy(() => import('./pages/site/Inscricao'))
const VagasPublico = lazy(() => import('./pages/site/Vagas').then(m => ({ default: m.VagasPublico })))
const VagaPublica = lazy(() => import('./pages/site/Vagas').then(m => ({ default: m.VagaPublica })))
const ContaEntrar = lazy(() => import('./pages/site/Contas').then(m => ({ default: m.ContaEntrar })))
const CandidatoCadastro = lazy(() => import('./pages/site/Contas').then(m => ({ default: m.CandidatoCadastro })))
const EmpresaCadastro = lazy(() => import('./pages/site/Contas').then(m => ({ default: m.EmpresaCadastro })))
const ContaRecuperar = lazy(() => import('./pages/site/Contas').then(m => ({ default: m.ContaRecuperar })))
const ContaRedefinir = lazy(() => import('./pages/site/Contas').then(m => ({ default: m.ContaRedefinir })))

// Áreas de candidato, empresa parceira e instituição de ensino
const CandidatoPainel = lazy(() => import('./pages/contas/Candidato').then(m => ({ default: m.CandidatoPainel })))
const CandidatoPerfil = lazy(() => import('./pages/contas/Candidato').then(m => ({ default: m.CandidatoPerfil })))
const PerfilOrganizacao = lazy(() => import('./pages/contas/Organizacao').then(m => ({ default: m.PerfilOrganizacao })))
const InstituicaoEstudantes = lazy(() => import('./pages/contas/Organizacao').then(m => ({ default: m.InstituicaoEstudantes })))
const InstituicaoCandidaturas = lazy(() => import('./pages/contas/Organizacao').then(m => ({ default: m.InstituicaoCandidaturas })))
const MinhasVagas = lazy(() => import('./components/GestaoVagas').then(m => ({ default: m.MinhasVagas })))
const FormVaga = lazy(() => import('./components/GestaoVagas').then(m => ({ default: m.FormVaga })))
const CandidaturasVaga = lazy(() => import('./components/GestaoVagas').then(m => ({ default: m.CandidaturasVaga })))

// Área do Associado: cursos e vagas
const CursosAssociado = lazy(() => import('./pages/app/CursosVagas').then(m => ({ default: m.CursosAssociado })))
const CursoAssociado = lazy(() => import('./pages/app/CursosVagas').then(m => ({ default: m.CursoAssociado })))
const VagasAssociado = lazy(() => import('./pages/app/CursosVagas').then(m => ({ default: m.VagasAssociado })))
const VagaFormAssociado = lazy(() => import('./pages/app/CursosVagas').then(m => ({ default: m.VagaFormAssociado })))
const CandidaturasAssociado = lazy(() => import('./pages/app/CursosVagas').then(m => ({ default: m.CandidaturasAssociado })))

const MENU_CANDIDATO = [
  { to: '/candidato', rotulo: 'Minhas candidaturas', icone: Briefcase, fim: true },
  { to: '/candidato/perfil', rotulo: 'Meu currículo', icone: FileUser },
  { to: '/vagas', rotulo: 'Vagas abertas', icone: Search },
]
const MENU_EMPRESA = [
  { to: '/empresa', rotulo: 'Minhas vagas', icone: Briefcase, fim: true },
  { to: '/empresa/vagas/nova', rotulo: 'Anunciar vaga', icone: Plus },
  { to: '/empresa/perfil', rotulo: 'Dados da empresa', icone: Building2 },
]
const MENU_INSTITUICAO = [
  { to: '/instituicao', rotulo: 'Estudantes', icone: GraduationCap, fim: true },
  { to: '/instituicao/candidaturas', rotulo: 'Candidaturas', icone: Users },
  { to: '/vagas?tipo=estagio', rotulo: 'Vagas de estágio', icone: Search },
  { to: '/instituicao/perfil', rotulo: 'Dados da instituição', icone: Building2 },
]

export default function App() {
  return (
    <ToastProvider>
      <AssociadoProvider>
        <AdminProvider>
        <ContasProvider>
          <Suspense fallback={<Carregando />}>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/associe-se" element={<Cadastro />} />
              <Route path="/validar/:codigo" element={<Validar />} />
              <Route path="/recuperar-senha" element={<RecuperarAssociado />} />
              <Route path="/redefinir-senha" element={<RedefinirAssociado />} />
              <Route path="/admin/recuperar-senha" element={<RecuperarAdmin />} />
              <Route path="/admin/redefinir-senha" element={<RedefinirAdmin />} />

              <Route path="/cursos" element={<CursosPublico />} />
              <Route path="/cursos/:id" element={<CursoPublico />} />
              <Route path="/inscricao/:codigo" element={<Inscricao />} />
              <Route path="/vagas" element={<VagasPublico />} />
              <Route path="/vagas/:id" element={<VagaPublica />} />
              <Route path="/candidato/entrar" element={<ContaEntrar tipo="candidato" />} />
              <Route path="/candidato/cadastro" element={<CandidatoCadastro />} />
              <Route path="/empresa/entrar" element={<ContaEntrar tipo="empresa" />} />
              <Route path="/empresa/cadastro" element={<EmpresaCadastro />} />
              <Route path="/instituicao/entrar" element={<ContaEntrar tipo="instituicao" />} />
              <Route path="/conta/recuperar" element={<ContaRecuperar />} />
              <Route path="/conta/redefinir" element={<ContaRedefinir />} />

              <Route path="/candidato" element={<ContaLayout tipo="candidato" itens={MENU_CANDIDATO} />}>
                <Route index element={<CandidatoPainel />} />
                <Route path="perfil" element={<CandidatoPerfil />} />
              </Route>
              <Route path="/empresa" element={<ContaLayout tipo="empresa" itens={MENU_EMPRESA} />}>
                <Route index element={<MinhasVagas area="empresa" base="/empresa/vagas" />} />
                <Route path="vagas" element={<Navigate to="/empresa" replace />} />
                <Route path="vagas/nova" element={<FormVaga area="empresa" base="/empresa/vagas" />} />
                <Route path="vagas/:id" element={<CandidaturasVaga area="empresa" base="/empresa/vagas" />} />
                <Route path="vagas/:id/editar" element={<FormVaga area="empresa" base="/empresa/vagas" />} />
                <Route path="perfil" element={<PerfilOrganizacao tipo="empresa" />} />
              </Route>
              <Route path="/instituicao" element={<ContaLayout tipo="instituicao" itens={MENU_INSTITUICAO} />}>
                <Route index element={<InstituicaoEstudantes />} />
                <Route path="candidaturas" element={<InstituicaoCandidaturas />} />
                <Route path="perfil" element={<PerfilOrganizacao tipo="instituicao" />} />
              </Route>

              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Inicio />} />
                <Route path="classificados" element={<Classificados />} />
                <Route path="classificados/meus" element={<MeusAnuncios />} />
                <Route path="classificados/novo" element={<AnuncioForm />} />
                <Route path="classificados/:id" element={<ClassificadoDetalhe />} />
                <Route path="classificados/:id/editar" element={<AnuncioForm />} />
                <Route path="conveniados" element={<Conveniados />} />
                <Route path="boletos" element={<Boletos />} />
                <Route path="comunicados" element={<Comunicados />} />
                <Route path="comunicados/:id" element={<ComunicadoDetalhe />} />
                <Route path="carteirinha" element={<Carteirinha />} />
                <Route path="recredenciamento" element={<Recredenciamento />} />
                <Route path="cadastro" element={<MeuCadastro />} />
                <Route path="cursos" element={<CursosAssociado />} />
                <Route path="cursos/:id" element={<CursoAssociado />} />
                <Route path="vagas" element={<VagasAssociado />} />
                <Route path="vagas/nova" element={<VagaFormAssociado />} />
                <Route path="vagas/:id" element={<CandidaturasAssociado />} />
                <Route path="vagas/:id/editar" element={<VagaFormAssociado />} />
              </Route>

              <Route path="/admin/entrar" element={<AdminEntrar />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Painel />} />
                <Route path="associados" element={<AdmAssociados />} />
                <Route path="associados/:id" element={<AdmAssociadoFicha />} />
                <Route path="recredenciamentos" element={<AdmRecredenciamentos />} />
                <Route path="classificados" element={<AdmClassificados />} />
                <Route path="conveniados" element={<AdmConveniados />} />
                <Route path="boletos" element={<AdmBoletos />} />
                <Route path="comunicados" element={<AdmComunicados />} />
                <Route path="categorias" element={<AdmCategorias />} />
                <Route path="usuarios" element={<AdmUsuarios />} />
                <Route path="configuracoes" element={<AdmConfiguracoes />} />
                <Route path="cursos" element={<AdmCursos />} />
                <Route path="cursos/:id" element={<AdmCursoInscritos />} />
                <Route path="vagas" element={<AdmVagas />} />
                <Route path="organizacoes" element={<AdmOrganizacoes />} />
                <Route path="candidatos" element={<AdmCandidatos />} />
              </Route>

              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Suspense>
        </ContasProvider>
        </AdminProvider>
      </AssociadoProvider>
    </ToastProvider>
  )
}
