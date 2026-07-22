// src/server/index.ts
// Web server for ULTRON v5 - web dashboard + streaming API

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { Orchestrator } from '../agents/orchestrator';
import type { AgentEvent } from '../agents/types';
import { getAllModels, getHealthyModelList } from '../llm/providers';
import { getHealthSummary } from '../llm/health';
import { getRouterInstance } from '../llm/chat';
import { RateLimiter } from './rate-limiter';
import { applySecurityHeaders } from './security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function findStaticDir(): string {
  const candidates = [
    path.join(__dirname, '..', 'src', 'server', 'public'), // bun run dist/index.js
    path.join(__dirname, 'public'),          // bun build --compile (standalone exe)
    path.join(__dirname, '..', 'server', 'public'), // fallback
  ];
  for (const d of candidates) {
    try { if (fs.existsSync(path.join(d, 'index.html'))) return d; } catch {}
  }
  return candidates[0];
}
const STATIC_DIR = findStaticDir();

const SSE_CLIENTS = new Set<(event: string, data: unknown) => void>();
const rateLimiter = new RateLimiter({ '/api/chat': 10, '/api/models': 30, '/api/status': 30, default: 60 }, 60_000);
setInterval(() => rateLimiter.cleanup(), 300_000);

export function startWebServer(
  orchestrator: Orchestrator,
  port = 3456,
): http.Server {
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    applySecurityHeaders(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url?.startsWith('/api/')) {
      const rl = rateLimiter.check(req.socket.remoteAddress || 'unknown', req.url);
      if (rl.limited) {
        res.writeHead(429, { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) }));
        return;
      }
    }
    if (req.url === '/api/chat' && req.method === 'POST') {
      handleChat(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/models' && req.method === 'GET') {
      handleModels(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/models' && req.method === 'POST') {
      handleSetModel(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
      handleStatus(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/health' && req.method === 'GET') {
      handleHealth(res);
      return;
    }
    if (req.url === '/api/router' && req.method === 'GET') {
      handleRouter(res);
      return;
    }
    if (req.url === '/ws') {
      handleSSE(req, res, orchestrator);
      return;
    }
    serveStatic(req, res);
  });

  const broadcast = (event: string, data: unknown) => {
    const dead: ((event: string, data: unknown) => void)[] = [];
    for (const send of SSE_CLIENTS) {
      try { send(event, data); } catch { dead.push(send); }
    }
    for (const d of dead) SSE_CLIENTS.delete(d);
  };

  orchestrator.setEventEmitter((event: AgentEvent) => {
    broadcast('event', event);
  });
  orchestrator.setStreamCallback((text: string) => {
    broadcast('stream', { content: text });
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`\n  Dashboard: ${url}\n`);
    try {
      const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      child_process.exec(cmd);
    } catch {}
    validateAllModels(broadcast).catch(() => {});
  });

  const shutdown = () => {
    broadcast('shutdown', {});
    SSE_CLIENTS.clear();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

// ===== HANDLERS =====

async function handleChat(req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  try {
    const body = await readBody(req);
    const { message, model: requestedModel } = JSON.parse(body);
    if (!message) { res.writeHead(400); res.end('missing message'); return; }

    if (requestedModel) orch.setCurrentModel(requestedModel);

    let aborted = false;
    req.on('close', () => { aborted = true; });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(JSON.stringify({ type: 'init', model: orch.getCurrentModel(), stats: orch.getStats() }) + '\n');

    const lid = orch.addListener({
      onEvent: (event: AgentEvent) => {
        if (aborted) return;
        try { res.write(JSON.stringify({ type: 'event', data: event }) + '\n'); if (event.type === 'done') res.write(JSON.stringify({ type: 'done' }) + '\n'); } catch {}
      },
      onStream: (text: string) => {
        if (aborted) return;
        try { res.write(JSON.stringify({ type: 'stream', content: text }) + '\n'); } catch {}
      },
    });

    try {
      const response = await orch.handleMessage(message);
      if (!aborted) {
        res.write(JSON.stringify({ type: 'result', response, model: orch.getCurrentModel(), tokens: orch.getStats() }) + '\n');
        res.end();
      }
    } finally {
      orch.removeListener(lid);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[chat] Error:', msg);
    try {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(JSON.stringify({ type: 'error', error: msg }) + '\n');
      res.end();
    } catch {}
  }
}

function handleModels(_req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  const all = getAllModels();
  const healthy = new Set(getHealthyModelList().map(m => m.model));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    current: orch.getCurrentModel(),
    models: all.map((m: { provider: string; model: string; free: boolean }) => ({
      ...m, healthy: healthy.has(m.model),
    })),
    stats: orch.getStats(),
  }));
}

async function handleSetModel(req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  try {
    const body = await readBody(req);
    const { model } = JSON.parse(body);
    if (!model) { res.writeHead(400); res.end('missing model'); return; }
    const ok = orch.setCurrentModel(model);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok, current: orch.getCurrentModel() }));
  } catch {
    res.writeHead(500); res.end('error');
  }
}

function handleStatus(_req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ model: orch.getCurrentModel(), stats: orch.getStats() }));
}

function handleRouter(res: ServerResponse) {
  try {
    const router = getRouterInstance();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(router.getState()));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Router not yet initialized' }));
  }
}

function handleHealth(res: ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    health: getHealthSummary(),
  }));
}

function handleSSE(_req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const send = (event: string, data: unknown) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { SSE_CLIENTS.delete(send); }
  };

  SSE_CLIENTS.add(send);
  send('init', { model: orch.getCurrentModel(), stats: orch.getStats() });

  res.on('close', () => { SSE_CLIENTS.delete(send); });
}

// ===== STATIC FILES =====

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const fullPath = path.join(STATIC_DIR, filePath);

  if (!fullPath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath);
      const mime = getMime(fullPath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } else {
      const indexFile = path.join(STATIC_DIR, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(indexFile));
      } else {
        res.writeHead(404); res.end('Not found');
      }
    }
  } catch {
    res.writeHead(500); res.end('Server error');
  }
}

function getMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return mimes[ext] || 'text/plain';
}

async function validateAllModels(
  broadcast: (event: string, data: unknown) => void,
): Promise<void> {
  const { getAllModels, getProviders } = await import('../llm/providers');

  const all = getAllModels();
  const total = all.length;
  if (total === 0) return;

  broadcast('validate', { type: 'start', total, message: `Validando ${total} modelos...` });

  let done = 0;
  let healthy = 0;
  let unhealthy = 0;
  const BATCH = 10;

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (m) => {
      const provider = getProviders().find(p => p.name === m.provider);
      if (!provider) return false;
      const res = await fetch(`${provider.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, temperature: 0 }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    }));

    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      const ok = r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value === true;
      if (ok) healthy++; else unhealthy++;
      done++;
      broadcast('validate', {
        type: 'progress', done, total,
        model: batch[j].model.split('/').pop() || batch[j].model,
        status: ok ? 'healthy' : 'unhealthy',
      });
    }
  }

  broadcast('validate', {
    type: 'done',
    healthy,
    unhealthy,
    total,
    message: `${healthy}/${total} modelos accesibles`,
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('close', () => reject(new Error('Client disconnected')));
    req.on('error', reject);
  });
}
