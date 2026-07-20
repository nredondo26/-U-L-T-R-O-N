// src/tools/search.ts
// Busqueda ultra-rapida: ripgrep > findstr > built-in

import { execSync } from 'child_process';

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

let rgAvailable: boolean | null = null;

function checkRg(): boolean {
  if (rgAvailable !== null) return rgAvailable;
  try {
    execSync('rg --version', { stdio: 'ignore', timeout: 3000 });
    rgAvailable = true;
  } catch {
    rgAvailable = false;
  }
  return rgAvailable;
}

export function fastSearch(
  query: string,
  directory: string,
  filePattern?: string,
  maxResults = 50,
): SearchResult[] {
  if (checkRg()) {
    return searchWithRg(query, directory, filePattern, maxResults);
  }
  return searchWithBuiltin(query, directory, filePattern, maxResults);
}

function searchWithRg(
  query: string,
  directory: string,
  filePattern?: string,
  maxResults = 50,
): SearchResult[] {
  try {
    const safeQuery = query.replace(/[;&|`$()]/g, '\\$&');
    const args = ['--no-heading', '--line-number', '--max-count', String(maxResults), '-e', safeQuery];
    if (filePattern) args.unshift('--glob', filePattern);

    const output = execSync(`rg ${args.map(a => `"${a}"`).join(' ')}`, {
      cwd: directory, timeout: 10000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    });

    return output.trim().split('\n').filter(Boolean).map(line => {
      const match = line.match(/^(.+?):(\d+):(.*)/);
      if (match) {
        return { file: match[1].trim(), line: parseInt(match[2]), content: match[3].trim() };
      }
      return { file: '', line: 0, content: line };
    }).filter(r => r.file);
  } catch {
    return [];
  }
}

function searchWithBuiltin(
  query: string,
  directory: string,
  filePattern?: string,
  maxResults = 50,
): SearchResult[] {
  const safeQuery = query.replace(/[;&|`$()"]/g, '');
  const isWindows = process.platform === 'win32';
  const cmd = isWindows
    ? `findstr /s /n /i /c:"${safeQuery}" ${filePattern || '*.*'}`
    : `grep -rn "${safeQuery}" . ${filePattern ? `--include="${filePattern}"` : ''}`;

  try {
    const output = execSync(cmd, { cwd: directory, timeout: 15000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean).slice(0, maxResults).map(line => {
      if (isWindows) {
        const match = line.match(/^(.+?):(\d+):(.*)/);
        if (match) return { file: match[1].trim(), line: parseInt(match[2]), content: match[3].trim() };
      } else {
        const match = line.match(/^(.+?):(\d+):(.*)/);
        if (match) return { file: match[1], line: parseInt(match[2]), content: match[3].trim() };
      }
      return { file: '', line: 0, content: line };
    }).filter(r => r.file);
  } catch {
    return [];
  }
}
