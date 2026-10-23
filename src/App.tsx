import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminProvider, AssociadoProvider } from './lib/auth'
import { Carregando, ToastProvider } from './components/ui'
import AppLayout from './layouts/AppLayout'
import AdminLayout from './layouts/AdminLayout'
import Entrar from './pages/public/Entrar'

const Cadastro = lazy(() => import('./pages/public/Cadastro'))
const Validar = lazy(() => import('./pages/public/Validar'))
const AdminEntrar = lazy(() => import('./pages/public/AdminEntrar'))

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

export default function App() {
  return (
    <ToastProvider>
      <AssociadoProvider>
        <AdminProvider>
          <Suspense fallback={<Carregando />}>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/associe-se" element={<Cadastro />} />
              <Route path="/validar/:codigo" element={<Validar />} />

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
              </Route>

              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Suspense>
        </AdminProvider>
      </AssociadoProvider>
    </ToastProvider>
  )
}
