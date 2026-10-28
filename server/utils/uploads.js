import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local dev keeps files in server/uploads (served statically).
// On Vercel the filesystem is read-only, so uploads land in /tmp
// (ephemeral per warm instance — see README for the limitation).
export const uploadsDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

// Vercel serverless request bodies are capped at ~4.5 MB.
const maxSize = process.env.VERCEL ? 4 * 1024 * 1024 : 25 * 1024 * 1024;

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
    },
  }),
  limits: { fileSize: maxSize },
});
