// src/tools/file-ops.ts
// Operaciones de archivo con verificacion - crea, guarda, verifica

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function saveToDesktop(filename: string, content: string): string {
  const desktop = path.join(os.homedir(), 'Desktop');
  const filePath = path.join(desktop, filename);
  fs.writeFileSync(filePath, content, 'utf8');

  if (fs.existsSync(filePath)) {
    return `Archivo guardado: ${filePath} (${content.length} bytes). Verificado: existe.`;
  }
  return `Error: no se pudo verificar ${filePath}`;
}

export function saveToFile(filePath: string, content: string): string {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');

  if (fs.existsSync(filePath)) {
    return `Guardado: ${filePath} (${content.length} bytes).`;
  }
  return `Error: no se pudo guardar ${filePath}`;
}

export function checkFile(filePath: string): string {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8').slice(0, 200);
    return `EXISTE: ${filePath}\nTamaño: ${stats.size} bytes\nModificado: ${stats.mtime.toISOString()}\nContenido: ${content}`;
  }
  // Try desktop
  const desktop = path.join(os.homedir(), 'Desktop', filePath);
  if (fs.existsSync(desktop)) {
    const stats = fs.statSync(desktop);
    return `EXISTE en Desktop: ${desktop}\nTamaño: ${stats.size} bytes\nModificado: ${stats.mtime.toISOString()}`;
  }
  return `NO EXISTE: ${filePath} (ni en Desktop)`;
}

export function getDesktopPath(): string {
  return path.join(os.homedir(), 'Desktop');
}
