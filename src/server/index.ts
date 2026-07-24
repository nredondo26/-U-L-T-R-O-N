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
import { log } from '../shared/logger';
import { RateLimiter } from './rate-limiter';
import { applySecurityHeaders } from './security';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_CONNECTIONS = 100;

export interface ServerConfig {
  port: number;
  bindAddr?: string;
  trustProxy?: boolean;
  apiKey?: string;
  noBrowser?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function findStaticDir(): string {
  const candidates = [
    path.join(__dirname, 'src', 'server', 'public'),       // bun run dist/index.js
    path.join(__dirname, '..', 'src', 'server', 'public'),  // npm start from dist/
    path.join(__dirname, '..', '..', 'src', 'server', 'public'), // run from dist/sub/
    path.join(__dirname, 'public'),                          // bun build --compile (same dir)
    path.join(path.dirname(process.execPath), 'public'),     // compiled exe + public folder
    path.join(path.dirname(process.execPath), 'src', 'server', 'public'),
    path.join(process.cwd(), 'public'),                      // launched from project root
    path.join(process.cwd(), 'src', 'server', 'public'),     // dev mode
    path.join(process.cwd(), 'dist', 'public'),              // production with dist/public
  ];
  for (const d of candidates) {
    try { if (fs.existsSync(path.join(d, 'index.html'))) return d; } catch { /* dir read failed */ }
  }
  return candidates[0];
}
const STATIC_DIR = findStaticDir();

const SSE_CLIENTS = new Set<(event: string, data: unknown) => void>();
const rateLimiter = new RateLimiter({ '/api/chat': 30, '/api/models': 60, '/api/status': 60, '/api/agents': 120, default: 120 }, 60_000);
setInterval(() => rateLimiter.cleanup(), 300_000);

interface QueuedMessage {
  message: string;
  model?: string;
  resolve: (response: string) => void;
  reject: (err: Error) => void;
}

export function startWebServer(
  orchestrator: Orchestrator,
  config: ServerConfig,
): http.Server {
  const port = config.port || 3456;
  const bindAddr = config.bindAddr || '127.0.0.1';
  const trustProxy = config.trustProxy || false;
  const apiKey = config.apiKey || '';
  const noBrowser = config.noBrowser || false;

  if (apiKey) {
    console.log(`  \u{1f512} Auth enabled — API key required for web access`);
  }

  let activeRequests = 0;
  let activeChat = false;
  const messageQueue: QueuedMessage[] = [];

  function processQueue(): void {
    if (activeChat || messageQueue.length === 0) return;
    const next = messageQueue.shift()!;
    activeChat = true;
    processChatMessage(next.message, next.model)
      .then(() => { next.resolve(''); })
      .catch(e => { next.reject(e); })
      .finally(() => { activeChat = false; processQueue(); });
  }

  function getClientIp(req: IncomingMessage): string {
    if (trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  function getRateLimitKey(req: IncomingMessage): string {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).slice(0, 12) : 'anon';
    return token + '|' + getClientIp(req);
  }

  function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!apiKey) return true;
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token === apiKey) return true;

    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="ULTRON"',
    });
    res.end(JSON.stringify({ error: 'Unauthorized. Provide a valid API key via Authorization: Bearer <key> header.' }));
    return false;
  }

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    activeRequests++;
    const startTime = Date.now();
    const clientIp = getClientIp(req);
    const logReq = () => console.log(`[http] ${req.method} ${req.url} ip=${clientIp} active=${activeRequests} time=${Date.now()-startTime}ms`);
    res.on('finish', () => { activeRequests--; logReq(); });
    applySecurityHeaders(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/healthz' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      return;
    }

    if (req.url === '/metrics' && req.method === 'GET') {
      handleMetrics(res);
      return;
    }

    if (req.url === '/api/auth' && req.method === 'POST') {
      handleAuth(req, res);
      return;
    }

    if (req.url?.startsWith('/api/')) {
      const rl = rateLimiter.check(getRateLimitKey(req), req.url);
      if (rl.limited) {
        res.writeHead(429, { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) }));
        return;
      }
      if (!checkAuth(req, res)) return;
    }

    if (req.url === '/api/chat' && req.method === 'POST') {
      handleChat(req, res);
      return;
    }
    if (req.url === '/api/stop' && req.method === 'POST') {
      handleStop(res);
      return;
    }
    if (req.url === '/api/models' && req.method === 'GET') {
      handleModels(req, res);
      return;
    }
    if (req.url === '/api/models' && req.method === 'POST') {
      handleSetModel(req, res);
      return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
      handleStatus(req, res);
      return;
    }
    if (req.url === '/api/agents' && req.method === 'GET') {
      handleAgents(res);
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
    if (req.url === '/api/logs' && req.method === 'GET') {
      handleLogs(req, res);
      return;
    }
    if (req.url === '/ws') {
      handleSSE(req, res);
      return;
    }
    serveStatic(req, res);
  });

  server.maxConnections = MAX_CONNECTIONS;
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 62000;

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

  server.listen(port, bindAddr, () => {
    const url = `http://${bindAddr === '0.0.0.0' ? 'localhost' : bindAddr}:${port}`;
    console.log(`\n  Dashboard: ${url}\n`);
    if (!noBrowser) {
      try {
        const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
        child_process.exec(cmd);
      } catch { /* browser launch failed, server still running */ }
    }
    validateAllModels(broadcast).catch((err: unknown) => {
      log.error('Model validation failed', { error: err instanceof Error ? err.message : String(err) });
    });
  });

  const shutdown = () => {
    broadcast('shutdown', {});
    SSE_CLIENTS.clear();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    console.error('[FATAL] Uncaught exception:', err);
    shutdown();
  });
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
    console.error('[WARN] Unhandled rejection (server continues):', reason);
  });

  // ===== HANDLERS =====

  async function handleChat(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await readBody(req);
      const { message, model: requestedModel } = JSON.parse(body);
      if (!message) { safeJson(res, 400, { error: 'missing message' }); return; }

      if (requestedModel) orchestrator.setCurrentModel(requestedModel);

      if (activeChat) {
        messageQueue.push({
          message,
          model: requestedModel,
          resolve: (response) => {
            safeJson(res, 200, { type: 'queued_result', response, model: orchestrator.getCurrentModel(), tokens: orchestrator.getStats() });
          },
          reject: () => {
            safeJson(res, 500, { error: 'Queue processing failed' });
          },
        });
        safeJson(res, 202, { type: 'queued', position: messageQueue.length, message: 'Mensaje encolado. Procesando...' });
        return;
      }

      activeChat = true;
      const result = await processChatMessage(message, requestedModel, req, res);
      activeChat = false;
      processQueue();
      return result;
    } catch (e: unknown) {
      activeChat = false;
      processQueue();
      const msg = e instanceof Error ? e.message : String(e);
      log.error('Chat error', { error: msg });
      safeJson(res, 200, { type: 'error', error: msg });
    }
  }

  async function processChatMessage(
    message: string,
    requestedModel?: string,
    req?: IncomingMessage,
    res?: ServerResponse,
  ): Promise<void> {
    let aborted = false;
    if (req) {
      req.on('close', () => { aborted = true; orchestrator.cancel(); });
    }

    if (res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(JSON.stringify({ type: 'init', model: orchestrator.getCurrentModel(), stats: orchestrator.getStats() }) + '\n');
    }

    const lid = orchestrator.addListener({
      onEvent: (event: AgentEvent) => {
        if (aborted || !res) return;
        try { res.write(JSON.stringify({ type: 'event', data: event }) + '\n'); if (event.type === 'done') res.write(JSON.stringify({ type: 'done' }) + '\n'); } catch { aborted = true; }
      },
      onStream: (text: string) => {
        if (aborted || !res) return;
        try { res.write(JSON.stringify({ type: 'stream', content: text }) + '\n'); } catch { aborted = true; }
      },
    });

    try {
      const response = await orchestrator.handleMessage(message);
      if (res && !aborted) {
        res.write(JSON.stringify({ type: 'result', response, model: orchestrator.getCurrentModel(), tokens: orchestrator.getStats() }) + '\n');
        res.end();
      }
    } finally {
      orchestrator.removeListener(lid);
    }
  }

  function handleStop(res: ServerResponse) {
    orchestrator.cancel();
    safeJson(res, 200, { ok: true, message: 'Request cancelado' });
  }

  async function handleAuth(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await readBody(req);
      const { key } = JSON.parse(body);
      if (!apiKey) {
        safeJson(res, 200, { ok: true, message: 'Auth disabled — no API key configured on server.' });
        return;
      }
      if (key === apiKey) {
        safeJson(res, 200, { ok: true, token: apiKey });
      } else {
        safeJson(res, 401, { ok: false, error: 'Invalid API key.' });
      }
    } catch (e: unknown) {
      safeJson(res, 400, { ok: false, error: 'Invalid request.' });
    }
  }

  function safeJson(res: ServerResponse, status: number, data: unknown): void {
    try {
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch { /* response already ended */ }
  }

  function handleModels(_req: IncomingMessage, res: ServerResponse) {
    const all = getAllModels();
    const healthy = new Set(getHealthyModelList().map(m => m.model));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      current: orchestrator.getCurrentModel(),
      models: all.map((m: { provider: string; model: string; free: boolean }) => ({
        ...m, healthy: healthy.has(m.model),
      })),
      stats: orchestrator.getStats(),
    }));
  }

  async function handleSetModel(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await readBody(req);
      const { model } = JSON.parse(body);
      if (!model) { res.writeHead(400); res.end('missing model'); return; }
      const ok = orchestrator.setCurrentModel(model);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok, current: orchestrator.getCurrentModel() }));
    } catch (e: unknown) {
      log.error('Set model error', { error: e instanceof Error ? e.message : String(e) });
      res.writeHead(500); res.end('error');
    }
  }

  function handleStatus(_req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: orchestrator.getCurrentModel(), stats: orchestrator.getStats() }));
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

  function handleLogs(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const lines = parseInt(url.searchParams.get('lines') || '50', 10);
    const { getRecentLogs } = require('../shared/logger');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(getRecentLogs(Math.min(lines, 500)));
  }

  function handleMetrics(res: ServerResponse) {
    const mem = process.memoryUsage();
    let compB = 0, compA = 0;
    try {
      const { getStats } = require('../llm/compression/index');
      const s = getStats();
      compB = s.before; compA = s.after;
    } catch { /* compression not initialized */ }
    const metrics = [
      '# HELP ultron_uptime_seconds Server uptime',
      '# TYPE ultron_uptime_seconds gauge',
      `ultron_uptime_seconds ${process.uptime()}`,
      '# HELP ultron_memory_bytes Memory usage',
      '# TYPE ultron_memory_bytes gauge',
      `ultron_memory_rss_bytes ${mem.rss}`,
      `ultron_memory_heap_bytes ${mem.heapUsed}`,
      '# HELP ultron_http_requests_active Active HTTP requests',
      '# TYPE ultron_http_requests_active gauge',
      `ultron_http_requests_active ${activeRequests}`,
      '# HELP ultron_sse_clients Active SSE connections',
      '# TYPE ultron_sse_clients gauge',
      `ultron_sse_clients ${SSE_CLIENTS.size}`,
      '# HELP ultron_compression_bytes Token compression stats',
      '# TYPE ultron_compression_bytes gauge',
      `ultron_compression_bytes_before ${compB}`,
      `ultron_compression_bytes_after ${compA}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(metrics + '\n');
  }

  function handleAgents(res: ServerResponse): void {
    orchestrator.cleanupAgentStates();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents: orchestrator.getAgentStates() }));
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

  function handleSSE(_req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: unknown) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { SSE_CLIENTS.delete(send); }
    };

    SSE_CLIENTS.add(send);
    send('init', { model: orchestrator.getCurrentModel(), stats: orchestrator.getStats() });

    res.on('close', () => { SSE_CLIENTS.delete(send); });
  }

  // ===== STATIC FILES =====

  function serveStatic(req: IncomingMessage, res: ServerResponse) {
    let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';
    const fullPath = path.join(STATIC_DIR, filePath);

    if (!fullPath.startsWith(STATIC_DIR)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    const cacheHeaders = fullPath.endsWith('.html') ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' } : { 'Cache-Control': 'public, max-age=3600' };
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath);
        const mime = getMime(fullPath);
        res.writeHead(200, { 'Content-Type': mime, ...cacheHeaders });
        res.end(content);
      } else {
        const indexFile = path.join(STATIC_DIR, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
          res.end(fs.readFileSync(indexFile));
        } else {
          res.writeHead(404); res.end('Not found');
        }
      }
    } catch (e: unknown) {
      log.error('Static file error', { error: e instanceof Error ? e.message : String(e), file: filePath });
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
    const { getAllModels: getAll, getProviders: getProvs } = await import('../llm/providers');

    const all = getAll();
    const total = all.length;
    if (total === 0) return;

    broadcast('validate', { type: 'start', total, message: `Validando ${total} modelos...` });

    let done = 0;
    let healthy = 0;
    let unhealthy = 0;
    const BATCH = 10;
    const allResults: Array<{ model: string; ok: boolean }> = [];

    for (let i = 0; i < all.length; i += BATCH) {
      const batch = all.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(async (m) => {
        const provider = getProvs().find(p => p.name === m.provider);
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
        allResults.push({ model: batch[j].model, ok });
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

    try {
      const router = getRouterInstance();
      const cb = router.getCircuitBreaker();
      for (const r of allResults) {
        if (r.ok) cb.preUnblock(r.model);
        else cb.preBlock(r.model);
      }
    } catch { /* circuit breaker not yet initialized */ }
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', (c: Buffer | string) => {
        size += c.length;
        if (size > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Body too large'));
          return;
        }
        data += c;
      });
      req.on('end', () => resolve(data));
      req.on('close', () => reject(new Error('Client disconnected')));
      req.on('error', reject);
    });
  }

  return server;
}
