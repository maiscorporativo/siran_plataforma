-- SIRAN — Plataforma do Associado
-- Esquema idempotente: executado a cada inicialização (CREATE TABLE IF NOT EXISTS).
-- Compatível com MySQL 8 e MariaDB 10.4+ (Hostinger).

CREATE TABLE IF NOT EXISTS admin_usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  senha_hash    VARCHAR(100) NOT NULL,
  papel         ENUM('master','admin') NOT NULL DEFAULT 'admin',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  trocar_senha  TINYINT(1) NOT NULL DEFAULT 0,
  ultimo_login  DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessoes (
  token       CHAR(64) NOT NULL PRIMARY KEY,
  tipo        ENUM('associado','admin') NOT NULL,
  usuario_id  INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  INDEX idx_usuario (tipo, usuario_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS associados (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  matricula           VARCHAR(20) NULL UNIQUE,
  tipo_pessoa         ENUM('PF','PJ') NOT NULL DEFAULT 'PF',
  nome                VARCHAR(160) NOT NULL,
  cpf_cnpj            VARCHAR(14) NOT NULL UNIQUE,
  rg_ie               VARCHAR(30) NULL,
  data_nascimento     DATE NULL,
  email               VARCHAR(160) NULL,
  telefone            VARCHAR(20) NULL,
  whatsapp            VARCHAR(20) NULL,
  cep                 VARCHAR(8) NULL,
  logradouro          VARCHAR(160) NULL,
  numero              VARCHAR(20) NULL,
  complemento         VARCHAR(80) NULL,
  bairro              VARCHAR(80) NULL,
  cidade              VARCHAR(80) NULL,
  uf                  CHAR(2) NULL,
  -- Propriedade rural principal
  propriedade_nome      VARCHAR(160) NULL,
  propriedade_municipio VARCHAR(80) NULL,
  propriedade_area_ha   DECIMAL(12,2) NULL,
  atividades            VARCHAR(255) NULL,
  inscricao_produtor    VARCHAR(30) NULL,
  car                   VARCHAR(60) NULL,
  ccir                  VARCHAR(30) NULL,
  -- Situação
  status          ENUM('pendente','ativo','recusado','suspenso','inativo') NOT NULL DEFAULT 'pendente',
  motivo_status   VARCHAR(255) NULL,
  data_filiacao   DATE NULL,
  validade_ate    DATE NULL,
  codigo_validacao CHAR(16) NULL UNIQUE,
  senha_hash      VARCHAR(100) NULL,
  trocar_senha    TINYINT(1) NOT NULL DEFAULT 0,
  aceite_termos_em DATETIME NULL,
  observacoes     TEXT NULL,
  ultimo_login    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_validade (validade_ate),
  INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recredenciamentos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  associado_id    INT NOT NULL,
  status          ENUM('enviado','pendencia','aprovado','reprovado') NOT NULL DEFAULT 'enviado',
  dados           LONGTEXT NULL,
  observacao_associado TEXT NULL,
  resposta        TEXT NULL,
  analisado_por   INT NULL,
  analisado_em    DATETIME NULL,
  validade_anterior DATE NULL,
  validade_nova   DATE NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assoc (associado_id),
  INDEX idx_status (status),
  CONSTRAINT fk_recred_assoc FOREIGN KEY (associado_id) REFERENCES associados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS associado_documentos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  associado_id    INT NOT NULL,
  recredenciamento_id INT NULL,
  tipo            VARCHAR(40) NOT NULL,
  arquivo         VARCHAR(255) NOT NULL,
  nome_original   VARCHAR(255) NULL,
  mime            VARCHAR(80) NULL,
  tamanho         INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assoc (associado_id),
  CONSTRAINT fk_doc_assoc FOREIGN KEY (associado_id) REFERENCES associados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  escopo  ENUM('classificado','conveniado') NOT NULL,
  nome    VARCHAR(80) NOT NULL,
  slug    VARCHAR(80) NOT NULL,
  icone   VARCHAR(40) NULL,
  ordem   INT NOT NULL DEFAULT 0,
  ativo   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_escopo_slug (escopo, slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classificados (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  associado_id    INT NOT NULL,
  categoria_id    INT NULL,
  tipo            ENUM('venda','servico','procura','troca') NOT NULL DEFAULT 'venda',
  titulo          VARCHAR(120) NOT NULL,
  descricao       TEXT NOT NULL,
  preco           DECIMAL(14,2) NULL,
  preco_tipo      ENUM('fixo','negociavel','a_combinar') NOT NULL DEFAULT 'fixo',
  condicao        ENUM('novo','usado','nao_se_aplica') NOT NULL DEFAULT 'nao_se_aplica',
  marca           VARCHAR(60) NULL,
  modelo          VARCHAR(60) NULL,
  ano             SMALLINT NULL,
  cidade          VARCHAR(80) NULL,
  uf              CHAR(2) NULL,
  contato_whatsapp VARCHAR(20) NULL,
  contato_telefone VARCHAR(20) NULL,
  status          ENUM('pendente','aprovado','reprovado','pausado','vendido') NOT NULL DEFAULT 'pendente',
  motivo_reprovacao VARCHAR(255) NULL,
  visualizacoes   INT NOT NULL DEFAULT 0,
  publicado_em    DATETIME NULL,
  expira_em       DATETIME NULL,
  moderado_por    INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status, expira_em),
  INDEX idx_assoc (associado_id),
  INDEX idx_cat (categoria_id),
  CONSTRAINT fk_class_assoc FOREIGN KEY (associado_id) REFERENCES associados(id) ON DELETE CASCADE,
  CONSTRAINT fk_class_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classificado_fotos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  classificado_id INT NOT NULL,
  arquivo         VARCHAR(255) NOT NULL,
  ordem           INT NOT NULL DEFAULT 0,
  INDEX idx_class (classificado_id),
  CONSTRAINT fk_foto_class FOREIGN KEY (classificado_id) REFERENCES classificados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conveniados (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nome              VARCHAR(160) NOT NULL,
  categoria_id      INT NULL,
  descricao         TEXT NULL,
  beneficio         VARCHAR(255) NULL,
  logradouro        VARCHAR(200) NULL,
  cidade            VARCHAR(80) NULL,
  uf                CHAR(2) NULL,
  area_atendimento  VARCHAR(255) NULL,
  telefone          VARCHAR(20) NULL,
  whatsapp          VARCHAR(20) NULL,
  email             VARCHAR(160) NULL,
  site              VARCHAR(200) NULL,
  instagram         VARCHAR(80) NULL,
  horario           VARCHAR(160) NULL,
  atende_24h        TINYINT(1) NOT NULL DEFAULT 0,
  entrega_rural     TINYINT(1) NOT NULL DEFAULT 0,
  atende_propriedade TINYINT(1) NOT NULL DEFAULT 0,
  logo              VARCHAR(255) NULL,
  destaque          TINYINT(1) NOT NULL DEFAULT 0,
  ativo             TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cat (categoria_id),
  INDEX idx_cidade (cidade),
  CONSTRAINT fk_conv_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS boletos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  associado_id    INT NOT NULL,
  competencia     CHAR(7) NOT NULL,
  descricao       VARCHAR(160) NULL,
  valor           DECIMAL(10,2) NOT NULL,
  vencimento      DATE NOT NULL,
  linha_digitavel VARCHAR(60) NULL,
  pix_copia_cola  TEXT NULL,
  arquivo         VARCHAR(255) NULL,
  status          ENUM('aberto','pago','cancelado') NOT NULL DEFAULT 'aberto',
  pago_em         DATE NULL,
  valor_pago      DECIMAL(10,2) NULL,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assoc_comp (associado_id, competencia),
  INDEX idx_status (status, vencimento),
  CONSTRAINT fk_bol_assoc FOREIGN KEY (associado_id) REFERENCES associados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicados (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  origem          ENUM('FAESP','SENAR','CNA','SIRAN','OUTROS') NOT NULL DEFAULT 'FAESP',
  tipo            ENUM('oficio','circular','comunicado','convencao','informativo') NOT NULL DEFAULT 'oficio',
  numero          VARCHAR(60) NULL,
  titulo          VARCHAR(200) NOT NULL,
  resumo          VARCHAR(500) NULL,
  conteudo        TEXT NULL,
  arquivo         VARCHAR(255) NULL,
  arquivo_nome    VARCHAR(255) NULL,
  data_publicacao DATE NOT NULL,
  destaque        TINYINT(1) NOT NULL DEFAULT 0,
  publicado       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pub (publicado, data_publicacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicado_leituras (
  comunicado_id   INT NOT NULL,
  associado_id    INT NOT NULL,
  lido_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comunicado_id, associado_id),
  CONSTRAINT fk_leit_com FOREIGN KEY (comunicado_id) REFERENCES comunicados(id) ON DELETE CASCADE,
  CONSTRAINT fk_leit_assoc FOREIGN KEY (associado_id) REFERENCES associados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS configuracoes (
  chave   VARCHAR(60) NOT NULL PRIMARY KEY,
  valor   VARCHAR(500) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS log_acoes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NULL,
  acao        VARCHAR(60) NOT NULL,
  entidade    VARCHAR(40) NOT NULL,
  entidade_id INT NULL,
  detalhes    VARCHAR(500) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ent (entidade, entidade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
