# SIRAN — Plataforma do Associado

Sistema web do Sindicato Rural da Alta Noroeste (Araçatuba-SP) para associados e equipe do sindicato.

| Área | Endereço | Quem usa |
|---|---|---|
| Área do associado | `/app` (login em `/entrar`) | Associados, com CPF/CNPJ e senha |
| Pedido de filiação | `/associe-se` | Quem quer se associar |
| Validação da carteirinha | `/validar/:codigo` | Conveniados (via QR Code) |
| Gestão | `/admin` (login em `/admin/entrar`) | Equipe do SIRAN |

## Módulos

- **Filiação e recredenciamento**: cadastro online com documentos, aprovação pela equipe, matrícula e validade. O recredenciamento abre N dias antes do vencimento (configurável). O associado revisa os dados e envia documentos; a equipe aprova, aponta pendência ou reprova. A aprovação renova a validade a partir do vencimento atual.
- **Carteirinha digital** com QR Code de validação pública.
- **Classificados** entre associados: anúncios com fotos, aprovação prévia da equipe, expiração automática, pausar, vendido e renovar. Toda edição volta para moderação.
- **Guia de conveniados** (parceiros que não são associados), com filtros por categoria, cidade atendida, 24 horas, entrega na zona rural e atendimento na propriedade.
- **Boletos**: a equipe envia os PDFs gerados no banco, um a um ou **em lote**. No lote, o associado é identificado pelo CPF/CNPJ ou pela matrícula no nome do arquivo. A baixa é manual ou por **planilha CSV**.
- **Ofícios e comunicados** da FAESP, do SENAR, da CNA e do SIRAN, com PDF anexo e controle de leitura.
- **Importação** dos associados atuais por planilha CSV. O acesso deles é liberado por senha provisória.

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
4. **Build**: `npm install && npm run build`. Arquivo de entrada: `server.js`.
5. Ao iniciar, o servidor cria as tabelas automaticamente. Confira em `/api/health`.

> **Backup**: faça backup regular do banco **e** da pasta `STORAGE_DIR`. Ela guarda documentos pessoais (LGPD), então não a coloque em local público.

## Primeiros passos da equipe

1. Entrar em `/admin` com o usuário master e trocar a senha.
2. **Configurações**: validade do credenciamento, prazo do recredenciamento e WhatsApp do sindicato.
3. **Equipe**: criar os acessos dos funcionários.
4. **Associados → Importar planilha**: carga dos associados atuais.
5. **Conveniados**: cadastrar os parceiros.
6. Para liberar o acesso de cada associado: ficha → **Liberar acesso**. A senha provisória pode ser enviada pelo WhatsApp com um clique.

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
