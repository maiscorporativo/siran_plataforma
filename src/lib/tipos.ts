export type StatusAssociado = 'pendente' | 'ativo' | 'recusado' | 'suspenso' | 'inativo'
export type Situacao = StatusAssociado | 'regular' | 'renovar' | 'vencido'

export interface Associado {
  id: number
  matricula: string | null
  tipo_pessoa: 'PF' | 'PJ'
  nome: string
  cpf_cnpj: string
  rg_ie: string | null
  data_nascimento: string | null
  email: string | null
  telefone: string | null
  whatsapp: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  propriedade_nome: string | null
  propriedade_municipio: string | null
  propriedade_area_ha: number | null
  atividades: string | null
  inscricao_produtor: string | null
  car: string | null
  ccir: string | null
  status: StatusAssociado
  motivo_status: string | null
  data_filiacao: string | null
  validade_ate: string | null
  codigo_validacao: string | null
  trocar_senha: number
  aceita_email: number
  aceita_whatsapp: number
  situacao: Situacao
  created_at: string
  observacoes?: string | null
  tem_senha?: boolean
  ultimo_login?: string | null
  boletos_vencidos?: number
}

export interface Admin {
  id: number
  nome: string
  email: string
  papel: 'master' | 'admin'
  trocar_senha: number
}

export interface Categoria {
  id: number
  nome: string
  slug?: string
  icone: string | null
  total?: number
}

export interface Classificado {
  id: number
  titulo: string
  tipo: 'venda' | 'servico' | 'procura' | 'troca'
  descricao?: string
  preco: number | null
  preco_tipo: 'fixo' | 'negociavel' | 'a_combinar'
  condicao?: 'novo' | 'usado' | 'nao_se_aplica'
  marca?: string | null
  modelo?: string | null
  ano?: number | null
  cidade: string | null
  uf: string | null
  categoria?: string | null
  categoria_id?: number | null
  contato_whatsapp?: string | null
  contato_telefone?: string | null
  status: 'pendente' | 'aprovado' | 'reprovado' | 'pausado' | 'vendido'
  status_exibido: string
  motivo_reprovacao?: string | null
  capa?: string | null
  fotos?: { id: number; url: string }[]
  anunciante?: string
  publicado_em?: string | null
  expira_em?: string | null
  visualizacoes?: number
  created_at?: string
  updated_at?: string
  meu?: boolean
}

export interface Conveniado {
  id: number
  nome: string
  categoria_id: number | null
  categoria: string | null
  descricao: string | null
  beneficio: string | null
  logradouro: string | null
  cidade: string | null
  uf: string | null
  area_atendimento: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  instagram: string | null
  horario: string | null
  atende_24h: number
  entrega_rural: number
  atende_propriedade: number
  logo: string | null
  destaque: number
  ativo: number
}

export interface Boleto {
  id: number
  competencia: string
  descricao: string | null
  valor: number
  vencimento: string
  linha_digitavel: string | null
  pix_copia_cola?: string | null
  tem_arquivo: number
  status: 'aberto' | 'pago' | 'cancelado'
  vencido: number
  pago_em: string | null
  valor_pago: number | null
  // admin
  associado_id?: number
  nome?: string
  matricula?: string | null
  cpf_cnpj?: string
}

export interface Comunicado {
  id: number
  origem: 'FAESP' | 'SENAR' | 'CNA' | 'SIRAN' | 'OUTROS'
  tipo: 'oficio' | 'circular' | 'comunicado' | 'convencao' | 'informativo'
  numero: string | null
  titulo: string
  resumo: string | null
  conteudo?: string | null
  data_publicacao: string
  destaque: number
  tem_arquivo: number
  arquivo_nome?: string | null
  lido?: number
  publicado?: number
  leituras?: number
}

export interface Paginado<T> {
  itens: T[]
  total: number
  pagina: number
  por_pagina: number
}

export const TIPO_ANUNCIO: Record<string, string> = {
  venda: 'Vendo', servico: 'Ofereço serviço', procura: 'Procuro', troca: 'Troco',
}

export const TIPO_COMUNICADO: Record<string, string> = {
  oficio: 'Ofício', circular: 'Circular', comunicado: 'Comunicado', convencao: 'Convenção', informativo: 'Informativo',
}

export const ORIGEM_COMUNICADO: Record<string, string> = {
  FAESP: 'FAESP', SENAR: 'SENAR', CNA: 'CNA', SIRAN: 'SIRAN', OUTROS: 'Outros',
}

/* ═══════════════ Cursos e eventos ═══════════════ */
export interface Curso {
  id: number
  tipo: 'curso' | 'evento'
  titulo: string
  resumo: string | null
  descricao?: string | null
  categoria: string | null
  realizacao: string | null
  instrutor: string | null
  cidade: string | null
  local: string | null
  data_inicio: string
  data_fim: string | null
  horario: string | null
  carga_horaria: number | null
  vagas: number | null
  publico: 'todos' | 'associados'
  inscricoes_ate: string | null
  imagem: string | null
  status: 'rascunho' | 'publicado' | 'cancelado'
  confirmadas: number
  em_espera: number
  vagas_restantes: number | null
  inscricoes_abertas: boolean
  lotado: boolean
  situacao: 'aberto' | 'inscricoes_encerradas' | 'em_andamento' | 'encerrado' | 'cancelado'
  minha_inscricao?: string | { status: string; codigo: string } | null
}

export interface Inscricao {
  id: number
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  cidade: string | null
  status: 'confirmada' | 'espera' | 'cancelada'
  presente: number | null
  created_at: string
  associado_id: number | null
  matricula: string | null
}

/* ═══════════════ Vagas de emprego e estágio ═══════════════ */
export interface Conta {
  id: number
  tipo_conta: 'empresa' | 'instituicao' | 'candidato'
  nome: string
  email: string
  whatsapp: string | null
  cidade: string | null
  uf: string | null
  status?: 'pendente' | 'ativa' | 'recusada' | 'suspensa'
  motivo_status?: string | null
  // organização
  cnpj?: string | null
  responsavel?: string | null
  cargo?: string | null
  telefone?: string | null
  site?: string | null
  descricao?: string | null
  // candidato
  cpf?: string
  data_nascimento?: string | null
  escolaridade?: string | null
  areas_interesse?: string | null
  resumo?: string | null
  experiencias?: string | null
  cnh?: string | null
  disponibilidade?: string | null
  curriculo_arquivo?: string | null
  estudante?: number
  instituicao_id?: number | null
  curso?: string | null
  periodo?: string | null
  matricula?: string | null
  previsao_conclusao?: string | null
  vinculo_status?: 'nao_informado' | 'pendente' | 'confirmado' | 'recusado'
  aceita_whatsapp?: number
  aceita_email?: number
}

export interface Vaga {
  id: number
  tipo: 'emprego' | 'estagio' | 'temporario'
  titulo: string
  area: string | null
  descricao: string
  requisitos: string | null
  beneficios: string | null
  remuneracao: string | null
  jornada: string | null
  quantidade: number
  cidade: string | null
  uf: string | null
  estagio_nivel: 'medio_tecnico' | 'superior' | 'ambos' | null
  estagio_cursos: string | null
  exibir_nome: number
  status: 'pendente' | 'aprovada' | 'reprovada' | 'pausada' | 'encerrada'
  status_exibido?: string
  motivo_reprovacao?: string | null
  publicado_em: string | null
  expira_em: string | null
  created_at: string
  updated_at?: string
  ofertante?: string
  ofertante_nome?: string
  ofertante_tipo?: 'associado' | 'empresa'
  candidaturas?: number
}

export interface Candidatura {
  id: number
  status: 'enviada' | 'em_analise' | 'entrevista' | 'aprovada' | 'nao_selecionada' | 'desistiu'
  mensagem: string | null
  created_at: string
  candidato_id: number
  nome: string
  cidade: string | null
  uf: string | null
  data_nascimento: string | null
  escolaridade: string | null
  areas_interesse: string | null
  resumo: string | null
  experiencias: string | null
  cnh: string | null
  disponibilidade: string | null
  tem_curriculo: number
  estudante: number
  curso: string | null
  periodo: string | null
  previsao_conclusao: string | null
  vinculo_status: string
  instituicao: string | null
  whatsapp: string | null
  email: string | null
}

export const TIPO_VAGA: Record<string, string> = { emprego: 'Emprego', estagio: 'Estágio', temporario: 'Temporário / safra' }
export const NIVEL_ESTAGIO: Record<string, string> = { medio_tecnico: 'Ensino médio / técnico', superior: 'Ensino superior', ambos: 'Médio, técnico ou superior' }
export const ESCOLARIDADE: Record<string, string> = { fundamental: 'Ensino fundamental', medio: 'Ensino médio', tecnico: 'Técnico', superior: 'Superior', pos: 'Pós-graduação' }
export const STATUS_CANDIDATURA: Record<string, string> = {
  enviada: 'Enviada', em_analise: 'Em análise', entrevista: 'Chamado para entrevista', aprovada: 'Selecionado', nao_selecionada: 'Não selecionado', desistiu: 'Desistiu',
}
