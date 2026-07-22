// src/shared/utils.ts
import * as fs from 'fs';
import * as path from 'path';

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadJSON<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn(`[utils] loadJSON failed for ${file}:`, e instanceof Error ? e.message : e);
  }
  return fallback;
}

export function saveJSON(file: string, data: unknown): void {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn(`[utils] saveJSON failed for ${file}:`, e instanceof Error ? e.message : e);
  }
}

export function sanitizeFilename(name: string): string {
  const result = name
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();
  // Fallback if result is empty or only dots
  if (!result || /^\.+$/.test(result)) return 'note';
  return result;
}

export function loadEnv(envPath?: string): void {
  const tryPaths = envPath
    ? [envPath]
    : [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '..', '.env'),
        path.join(path.dirname(process.execPath), '.env'),
      ];
  for (const p of tryPaths) {
    try {
      if (fs.existsSync(p)) {
        fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
          const eq = line.indexOf('=');
          if (eq > 0) {
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k && v && !process.env[k]) process.env[k] = v;
          }
        });
      }
    } catch (e) {
      console.warn(`[utils] loadEnv failed for ${p}:`, e instanceof Error ? e.message : e);
    }
  }
}

export function getTimestamp(): string {
  return new Date().toISOString().slice(11, 19);
}
