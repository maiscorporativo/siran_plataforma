import SiteLayout from '../../layouts/SiteLayout'
import { AgendaCursos } from '../../components/cursos'
import CursoDetalhe from '../../components/CursoDetalhe'
import { Cabecalho } from '../../components/ui'

export function CursosPublico() {
  return (
    <SiteLayout>
      <Cabecalho titulo="Cursos e eventos" descricao="Capacitações do SIRAN e do SENAR, encontros e eventos do agro na região. Inscreva-se online." />
      <AgendaCursos base="/cursos" />
    </SiteLayout>
  )
}

export function CursoPublico() {
  return <SiteLayout><CursoDetalhe voltar="/cursos" /></SiteLayout>
}
