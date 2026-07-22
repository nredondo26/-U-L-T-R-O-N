// src/tools/file.ts
// Herramientas de operaciones de archivos

import * as fs from 'fs';
import * as path from 'path';
import { ensureDir } from '../shared/utils';

function safeResolve(projectDir: string, filePath: string): string {
  const resolved = path.resolve(projectDir, filePath);
  if (!resolved.startsWith(path.resolve(projectDir))) {
    throw new Error(`Acceso denegado: ${filePath} esta fuera del directorio del proyecto`);
  }
  return resolved;
}

export function readFile(filePath: string, projectDir: string): string {
  const resolved = safeResolve(projectDir, filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Archivo no encontrado: ${filePath}`);
  const stat = fs.statSync(resolved);
  if (stat.size > 10 * 1024 * 1024) throw new Error(`Archivo demasiado grande: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`);
  return fs.readFileSync(resolved, 'utf8');
}

export function readFileRange(filePath: string, start: number, end: number, projectDir: string): string {
  const content = readFile(filePath, projectDir);
  const lines = content.split('\n');
  return lines.slice(start - 1, end).join('\n');
}

export function writeFile(filePath: string, content: string, projectDir: string): string {
  const resolved = safeResolve(projectDir, filePath);
  ensureDir(path.dirname(resolved));
  if (content.length > 10 * 1024 * 1024) throw new Error(`Contenido demasiado grande: ${(content.length / 1024 / 1024).toFixed(1)}MB (max 10MB)`);
  fs.writeFileSync(resolved, content, 'utf8');
  return resolved;
}

export function listFiles(dir: string, projectDir: string, maxDepth = 4): string[] {
  const resolved = safeResolve(projectDir, dir);
  const files: string[] = [];
  const scan = (d: string, depth: number): void => {
    if (depth > maxDepth) return;
    try {
      for (const item of fs.readdirSync(d, { withFileTypes: true })) {
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist' || item.name === '.git') continue;
        const relPath = path.relative(projectDir, path.join(d, item.name));
        if (item.isDirectory()) {
          scan(path.join(d, item.name), depth + 1);
        } else {
          files.push(relPath);
        }
      }
    } catch { /* skip unreadable directory */ }
  };
  scan(resolved, 0);
  return files.sort();
}

export function deleteFile(filePath: string, projectDir: string): boolean {
  const resolved = safeResolve(projectDir, filePath);
  if (fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
    return true;
  }
  return false;
}

export function searchFiles(pattern: string, projectDir: string): string[] {
  const all = listFiles('.', projectDir);
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
  return all.filter(f => regex.test(f));
}

export function searchInFiles(query: string, projectDir: string, filePattern?: string): Array<{ file: string; line: number; content: string }> {
  let files = listFiles('.', projectDir);
  if (filePattern) {
    const regex = new RegExp(filePattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    files = files.filter(f => regex.test(f));
  }

  const textExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.html', '.css', '.py', '.kt', '.java', '.rs', '.go', '.yml', '.yaml', '.toml', '.env', '.gitignore'];
  files = files.filter(f => textExts.includes(path.extname(f)) || !path.extname(f));

  const results: Array<{ file: string; line: number; content: string }> = [];
  for (const file of files.slice(0, 100)) {
    try {
      const content = readFile(file, projectDir);
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          results.push({ file, line: i + 1, content: lines[i].trim() });
          if (results.length >= 50) break;
        }
      }
    } catch { /* skip unreadable directory */ }
    if (results.length >= 50) break;
  }
  return results;
}
