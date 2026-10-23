import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { migrate } from './migrate.js';
import { publicoDir } from './lib/storage.js';
import authRouter from './routes/auth.js';
import associadoRouter from './routes/associado.js';
import classificadosRouter from './routes/classificados.js';
import conveniadosRouter from './routes/conveniados.js';
import boletosRouter from './routes/boletos.js';
import comunicadosRouter from './routes/comunicados.js';
import publicoRouter from './routes/publico.js';
import adminRouter from './routes/admin/index.js';
import { agendarLembretes } from './lib/avisos.js';
import { statusCanais } from './lib/notificacoes.js';

dotenv.config({ quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* Arquivos públicos (fotos de anúncios, logos). Documentos e boletos NÃO passam por aqui. */
app.use('/uploads', express.static(publicoDir, { maxAge: '30d', index: false }));

/* ── API ── */
app.use('/api/auth', authRouter);
app.use('/api/associado', associadoRouter);
app.use('/api/classificados', classificadosRouter);
app.use('/api/conveniados', conveniadosRouter);
app.use('/api/boletos', boletosRouter);
app.use('/api/comunicados', comunicadosRouter);
app.use('/api/publico', publicoRouter);
app.use('/api/admin', adminRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

/* ── Erros (inclusive de upload) ── */
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo muito grande.' });
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Quantidade de arquivos acima do permitido.' });
  }
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Requisição inválida.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json({ error: status >= 500 ? 'Erro interno. Tente novamente.' : err.message });
});

/* ── Frontend (produção) ── */
const distPath = join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath, { index: false, maxAge: '7d' }));
  app.get(/^(?!\/api|\/uploads).*$/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(distPath, 'index.html'));
  });
}

try {
  await migrate();
} catch (err) {
  console.error('❌ Falha ao preparar o banco:', err.message);
}

agendarLembretes();

app.listen(PORT, () => {
  const c = statusCanais();
  console.log(`   Envios:   e-mail ${c.email ? '✔' : '✘'} · WhatsApp ${c.whatsapp ? `✔ (${c.instancia})` : '✘'} · APP_URL ${c.app_url || '✘'}`);
  console.log(`\n🌱 SIRAN Plataforma rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Banco:    ${process.env.DB_NAME || 'siran_plataforma'} @ ${process.env.DB_HOST || 'localhost'}\n`);
});
