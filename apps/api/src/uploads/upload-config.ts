import { mkdirSync } from 'fs';
import { resolve } from 'path';

export const UPLOADS_ROUTE_PREFIX = '/uploads';

export function getUploadsDir() {
  const configured = process.env.UPLOAD_DIR;
  if (configured) {
    return resolve(process.cwd(), configured);
  }

  return resolve(process.cwd(), 'uploads');
}

export function ensureUploadsDir() {
  const uploadsDir = getUploadsDir();
  mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}
