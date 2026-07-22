// src/shared/logger.ts
// Logging profesional - funciona en dev y en binario compilado

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';

const logDir = path.join(os.homedir(), '.jarvis', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_LOG_AGE_DAYS = 7;

function rotateLogs(): void {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(logDir)) {
      const fp = path.join(logDir, f);
      const stat = fs.statSync(fp);
      if (stat.size > MAX_LOG_SIZE || (now - stat.mtimeMs) > MAX_LOG_AGE_DAYS * 86400000) {
        if (f.endsWith('.gz')) { fs.unlinkSync(fp); continue; }
        const gzPath = fp + '.gz';
        const content = fs.readFileSync(fp);
        fs.writeFileSync(gzPath, zlib.gzipSync(content));
        fs.unlinkSync(fp);
      }
    }
  } catch {}
}

const logFile = path.join(logDir, `jarvis-${new Date().toISOString().slice(0, 10)}.log`);
rotateLogs();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel: LogLevel = (process.env.JARVIS_LOG_LEVEL as LogLevel) || 'info';

function writeLog(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(data || {}),
  };

  const line = JSON.stringify(entry);

  // Console output (colored in dev)
  const colors: Record<LogLevel, string> = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
  const reset = '\x1b[0m';
  const ts = new Date().toISOString().slice(11, 19);

  if (process.env.NODE_ENV === 'production') {
    console.log(line);
  } else {
    console.log(`${colors[level]}[${ts}] ${level.toUpperCase()}${reset} ${msg}${data ? ' ' + JSON.stringify(data).slice(0, 100) : ''}`);
  }

  // File output
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch {}
}

export function getLogDir(): string { return logDir; }

export function getRecentLogs(lines = 50): string {
  try {
    if (!fs.existsSync(logFile)) return '(no logs yet)';
    const content = fs.readFileSync(logFile, 'utf8');
    return content.split('\n').filter(Boolean).slice(-lines).join('\n');
  } catch { return '(error reading logs)'; }
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => writeLog('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => writeLog('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => writeLog('error', msg, data),
  debug: (msg: string, data?: Record<string, unknown>) => writeLog('debug', msg, data),
  chat: (msg: string, data?: Record<string, unknown>) => writeLog('info', msg, { ...data, category: 'chat' }),
  tool: (name: string, args: Record<string, unknown>, result: string) => writeLog('info', `tool: ${name}`, { category: 'tool', tool: name, result: result.slice(0, 200) }),
  model: (model: string, tokens: number) => writeLog('info', `model: ${model}`, { category: 'model', model, tokens }),
};
