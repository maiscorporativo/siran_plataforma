# SIRAN — Plataforma do Associado

Sistema web do Sindicato Rural da Alta Noroeste (Araçatuba-SP) para associados e equipe do sindicato.

| Área | Endereço | Quem usa |
|---|---|---|
| Área do associado | `/app` (login em `/entrar`) | Associados, com CPF/CNPJ e senha |
| Pedido de filiação | `/associe-se` | Quem quer se associar |
| Validação da carteirinha | `/validar/:codigo` | Conveniados (via QR Code) |
| Gestão | `/admin` (login em `/admin/entrar`) | Equipe do SIRAN |
| Agenda de cursos e eventos | `/cursos` | Público e associados |
| Mural de vagas | `/vagas` | Público |
| Área do candidato | `/candidato` (login em `/candidato/entrar`) | Candidatos e estudantes |
| Empresas parceiras | `/empresa` (login em `/empresa/entrar`) | Empresas não associadas, aprovadas pelo SIRAN |
| Instituições de ensino | `/instituicao` (login em `/instituicao/entrar`) | Escolas convidadas pelo SIRAN |

## Módulos

- **Filiação e recredenciamento**: cadastro online com documentos, aprovação pela equipe, matrícula e validade. O recredenciamento abre N dias antes do vencimento (configurável). O associado revisa os dados e envia documentos; a equipe aprova, aponta pendência ou reprova. A aprovação renova a validade a partir do vencimento atual.
- **Carteirinha digital** com QR Code de validação pública.
- **Classificados** entre associados: anúncios com fotos, aprovação prévia da equipe, expiração automática, pausar, vendido e renovar. Toda edição volta para moderação.
- **Guia de conveniados** (parceiros que não são associados), com filtros por categoria, cidade atendida, 24 horas, entrega na zona rural e atendimento na propriedade.
- **Boletos**: a equipe envia os PDFs gerados no banco, um a um ou **em lote**. No lote, o associado é identificado pelo CPF/CNPJ ou pela matrícula no nome do arquivo. A baixa é manual ou por **planilha CSV**.
- **Ofícios e comunicados** da FAESP, do SENAR, da CNA e do SIRAN, com PDF anexo e controle de leitura.
- **Cursos e eventos**: agenda pública com inscrição online. A equipe define, em cada curso, se é aberto ao público ou só para associados. O associado se inscreve com um clique; o público preenche nome, CPF e contato. Há controle de vagas, lista de espera com promoção automática, cancelamento pelo link recebido, lembrete na véspera, lista de presença para imprimir e planilha de inscritos.
- **Vagas de emprego e estágio**: associados e empresas parceiras (cadastro aprovado pelo SIRAN) publicam vagas, todas moderadas. Candidatos criam conta e currículo (texto e/ou PDF) e se candidatam; o contato do candidato só aparece para quem publicou depois do convite para entrevista. Nos estágios, o estudante informa a instituição de ensino, que (convidada pelo SIRAN) confirma a matrícula e acompanha as candidaturas. O termo de compromisso de estágio, o seguro e os relatórios continuam fora da plataforma.
- **Importação** dos associados atuais por planilha CSV.
- **Recuperação de senha e primeiro acesso** pelo próprio associado: ele informa o CPF/CNPJ e recebe um link por WhatsApp e/ou e-mail. A equipe também pode enviar o link de acesso pela ficha, ou gerar uma senha provisória como alternativa.
- **Avisos automáticos** (e-mail via SMTP e WhatsApp via Evolution API): filiação aprovada ou recusada, recredenciamento analisado, anúncio aprovado ou reprovado, boleto disponível, lembretes de boleto e de vencimento do credenciamento, e novos comunicados (só quando a equipe marca "avisar associados"). A equipe recebe alertas de pedidos novos. O WhatsApp sai numa fila com intervalo entre mensagens, e tudo fica registrado em Configurações → Envios automáticos.

## Arquitetura

- **Frontend**: React 19 + Vite + Tailwind 4 (`src/`). Pensado para celular, com barra inferior, fotos reduzidas antes do envio e telas leves.
- **Backend**: Express 5 + MySQL/MariaDB (`server/`). Sessões com token salvas no banco, separadas para associado e equipe.
- **Banco**: `server/schema.sql` é aplicado automaticamente ao iniciar (idempotente), junto com as categorias e configurações padrão.
- **Arquivos** (`STORAGE_DIR`):
  - `publico/`: fotos de anúncios e logos, servidos em `/uploads`.
  - `privado/`: documentos pessoais, boletos e ofícios, entregues **só** por rotas autenticadas.

## Desenvolvimento

```bash
cp .env.example .env      # ajuste o banco e a senha inicial do admin
npm install
npm run migrate           # cria o banco local e as tabelas
npm run dev:all           # frontend em http://localhost:3020 + API em :3002
```

## Deploy na Hostinger (Node.js)

1. **Banco**: crie o banco MySQL no hPanel e anote host, usuário e senha.
2. **Pasta de arquivos**: crie uma pasta FORA da área de deploy, por exemplo `/home/uXXXX/domains/<dominio>/storage`. Assim os documentos e boletos não somem a cada deploy.
3. **Variáveis de ambiente** (painel Node.js):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `NODE_ENV=production`
   - `STORAGE_DIR=<caminho da pasta do passo 2>`
   - `ADMIN_MASTER_EMAIL` e `ADMIN_MASTER_PASSWORD`: usados só no primeiro start, para criar o usuário master. A troca de senha é exigida no primeiro login.
   - `APP_URL` (endereço público, ex.: `https://associado.siran.com.br`) e `TZ=America/Sao_Paulo`.
   - Opcionais, para os envios automáticos: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`. Sem eles, o sistema funciona normalmente, só não envia mensagens.
4. **Build**: `npm install && npm run build`. Arquivo de entrada: `server.js`.
5. Ao iniciar, o servidor cria as tabelas automaticamente. Confira em `/api/health`.

> **Backup**: faça backup regular do banco **e** da pasta `STORAGE_DIR`. Ela guarda documentos pessoais (LGPD), então não a coloque em local público.

## Primeiros passos da equipe

1. Entrar em `/admin` com o usuário master e trocar a senha.
2. **Configurações**: validade do credenciamento, prazo do recredenciamento e WhatsApp do sindicato.
3. **Equipe**: criar os acessos dos funcionários.
4. **Associados → Importar planilha**: carga dos associados atuais.
5. **Conveniados**: cadastrar os parceiros.
6. Para liberar o acesso de cada associado: ficha → **Enviar link de acesso**. Com WhatsApp ou e-mail cadastrado, o associado também consegue sozinho, em "Primeiro acesso ou esqueci a senha". Sem contato cadastrado, use **Senha provisória**.
7. Em **Configurações → Envios automáticos**, use **Testar conexão** e envie uma mensagem de teste.

## Formatos de planilha (CSV separado por `;`)

Importação de associados:
```
nome;cpf_cnpj;matricula;email;whatsapp;telefone;cidade;uf;data_filiacao;validade
```

Baixa de pagamentos (pode usar `matricula` no lugar de `cpf_cnpj`):
```
cpf_cnpj;competencia;data_pagamento;valor_pago
123.456.789-09;10/2026;12/10/2026;95,00
```
