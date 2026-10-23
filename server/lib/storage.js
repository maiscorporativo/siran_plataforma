import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── Pastas de armazenamento ───────────────────────────────────────
   STORAGE_DIR deve ficar FORA da área de deploy em produção.
   publico/  → servido em /uploads (fotos de anúncios, logos)
   privado/  → só via rotas autenticadas (documentos, boletos, ofícios) */
export const storageDir = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(__dirname, '..', '..', 'storage');
export const publicoDir = path.join(storageDir, 'publico');
export const privadoDir = path.join(storageDir, 'privado');

for (const d of [publicoDir, privadoDir]) fs.mkdirSync(d, { recursive: true });

const IMAGENS = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENTOS = [...IMAGENS, 'application/pdf'];
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };

function nomeUnico(mime) {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[mime] || ''}`;
}

function criarUpload({ base, subpasta, tipos, maxMB }) {
  const destino = path.join(base, subpasta);
  fs.mkdirSync(destino, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      // Recria a pasta se tiver sido removida com o servidor no ar
      destination: (_req, _file, cb) => fs.mkdir(destino, { recursive: true }, err => cb(err, destino)),
      filename: (_req, file, cb) => cb(null, nomeUnico(file.mimetype)),
    }),
    limits: { fileSize: maxMB * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => {
      if (tipos.includes(file.mimetype)) cb(null, true);
      else cb(Object.assign(new Error(`Tipo de arquivo não permitido: ${file.originalname}`), { status: 400 }));
    },
  });
}

export const uploadFotoAnuncio  = criarUpload({ base: publicoDir, subpasta: 'anuncios', tipos: IMAGENS, maxMB: 6 });
export const uploadLogo         = criarUpload({ base: publicoDir, subpasta: 'conveniados', tipos: IMAGENS, maxMB: 3 });
export const uploadDocumento    = criarUpload({ base: privadoDir, subpasta: 'documentos', tipos: DOCUMENTOS, maxMB: 10 });
export const uploadBoleto       = criarUpload({ base: privadoDir, subpasta: 'boletos', tipos: ['application/pdf'], maxMB: 5 });
export const uploadComunicado   = criarUpload({ base: privadoDir, subpasta: 'comunicados', tipos: ['application/pdf'], maxMB: 20 });
export const uploadPlanilha     = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/* Caminho relativo salvo no banco: "anuncios/123-abc.jpg" */
export function relativo(file) {
  return `${path.basename(file.destination)}/${file.filename}`;
}

export function urlPublica(rel) {
  return rel ? `/uploads/${rel}` : null;
}

function resolverSeguro(base, rel) {
  const alvo = path.resolve(base, rel);
  if (!alvo.startsWith(base + path.sep)) throw new Error('Caminho inválido');
  return alvo;
}

export function removerArquivo(rel, privado = false) {
  if (!rel) return;
  try {
    fs.unlinkSync(resolverSeguro(privado ? privadoDir : publicoDir, rel));
  } catch { /* arquivo já removido */ }
}

/* Envia um arquivo privado; nomeDownload define o nome sugerido */
export function enviarPrivado(res, rel, nomeDownload) {
  let alvo;
  try { alvo = resolverSeguro(privadoDir, rel); } catch { return res.status(400).json({ error: 'Arquivo inválido' }); }
  if (!fs.existsSync(alvo)) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.setHeader('Cache-Control', 'private, no-store');
  if (nomeDownload) {
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nomeDownload)}`);
  }
  res.sendFile(alvo);
}
