import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config({ quiet: true });
const __dirname = dirname(fileURLToPath(import.meta.url));

const CATEGORIAS_CLASSIFICADO = [
  ['Máquinas agrícolas', 'maquinas', 'tractor'],
  ['Implementos', 'implementos', 'wrench'],
  ['Veículos e utilitários', 'veiculos', 'truck'],
  ['Animais', 'animais', 'beef'],
  ['Insumos e sementes', 'insumos', 'sprout'],
  ['Produção e alimentos', 'producao', 'wheat'],
  ['Equipamentos e ferramentas', 'equipamentos', 'hammer'],
  ['Arrendamento e imóveis rurais', 'imoveis', 'land-plot'],
  ['Serviços', 'servicos', 'handshake'],
  ['Outros', 'outros', 'package'],
];

const CATEGORIAS_CONVENIADO = [
  ['Farmácias', 'farmacias', 'pill'],
  ['Veterinários', 'veterinarios', 'stethoscope'],
  ['Mecânica de máquinas agrícolas', 'mecanica', 'cog'],
  ['Alimentação e delivery', 'alimentacao', 'utensils'],
  ['Agropecuárias e insumos', 'agropecuarias', 'store'],
  ['Saúde', 'saude', 'heart-pulse'],
  ['Combustíveis e lubrificantes', 'combustiveis', 'fuel'],
  ['Serviços técnicos', 'servicos-tecnicos', 'hard-hat'],
  ['Outros', 'outros', 'package'],
];

export const CONFIG_PADRAO = {
  validade_meses: '12',
  aviso_recredenciamento_dias: '60',
  anuncio_validade_dias: '60',
  anuncio_max_fotos: '8',
  valor_mensalidade: '',
  whatsapp_sindicato: '551836077826',
  telefone_sindicato: '(18) 3607-7826',
  email_sindicato: 'contato@siran.com.br',
  // E-mails da equipe avisados sobre novos pedidos de filiação, recredenciamentos e anúncios
  notif_equipe_emails: '',
  // Lembrete de boleto: quantos dias antes do vencimento
  lembrete_boleto_dias: '3',
};

/* Colunas acrescentadas depois da primeira versão (bancos já existentes) */
const COLUNAS_NOVAS = [
  ['associados', 'aceita_whatsapp', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER trocar_senha'],
  ['associados', 'aceita_email', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER aceita_whatsapp'],
];

/* Separa o schema em comandos — o arquivo não usa ';' dentro de valores */
function statements(sql) {
  return sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

export async function migrate({ log = console.log } = {}) {
  const sql = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  for (const stmt of statements(sql)) await pool.query(stmt);
  for (const [tabela, coluna, def] of COLUNAS_NOVAS) {
    const [[{ c }]] = await pool.query(
      'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [tabela, coluna]);
    if (!c) {
      await pool.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${def}`);
      log(`✅ Coluna ${tabela}.${coluna} criada`);
    }
  }

  const seedCats = async (escopo, lista) => {
    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM categorias WHERE escopo = ?', [escopo]);
    if (c > 0) return;
    for (const [i, [nome, slug, icone]] of lista.entries()) {
      await pool.query(
        'INSERT INTO categorias (escopo, nome, slug, icone, ordem) VALUES (?, ?, ?, ?, ?)',
        [escopo, nome, slug, icone, i]
      );
    }
    log(`✅ Categorias de ${escopo} criadas`);
  };
  await seedCats('classificado', CATEGORIAS_CLASSIFICADO);
  await seedCats('conveniado', CATEGORIAS_CONVENIADO);

  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
    await pool.query('INSERT IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)', [chave, valor]);
  }

  const [[{ admins }]] = await pool.query('SELECT COUNT(*) AS admins FROM admin_usuarios');
  if (admins === 0) {
    const email = process.env.ADMIN_MASTER_EMAIL;
    const senha = process.env.ADMIN_MASTER_PASSWORD;
    if (email && senha) {
      await pool.query(
        "INSERT INTO admin_usuarios (nome, email, senha_hash, papel, trocar_senha) VALUES ('Administrador', ?, ?, 'master', 1)",
        [email.toLowerCase(), await bcrypt.hash(senha, 10)]
      );
      log(`✅ Usuário master criado: ${email} (troca de senha exigida no primeiro login)`);
    } else {
      log('⚠️  Nenhum usuário administrativo. Defina ADMIN_MASTER_EMAIL e ADMIN_MASTER_PASSWORD no .env');
    }
  }

  await pool.query('DELETE FROM sessoes WHERE expires_at < NOW()');
  await pool.query('DELETE FROM senha_tokens WHERE expires_at < NOW() - INTERVAL 7 DAY');
}

/* Uso direto: `npm run migrate` — cria o banco local se ainda não existir */
/* Sem await no topo do módulo: a Hostinger carrega o app com require(),
   que não aceita módulos com top-level await. */
async function executarPelaLinhaDeComando() {
  const name = process.env.DB_NAME || 'siran_plataforma';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  await migrate();
  console.log('✅ Migração concluída');
  await pool.end();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  executarPelaLinhaDeComando().catch(err => {
    console.error('❌ Migração falhou:', err.message);
    process.exit(1);
  });
}
