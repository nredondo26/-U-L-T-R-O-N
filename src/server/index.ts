// src/server/index.ts
// Servidor web para J.A.R.V.I.S. v5 - interfaz grafica + WebSocket streaming

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { Orchestrator } from '../agents/orchestrator';
import type { AgentEvent } from '../agents/types';
import { getAllModels, getHealthyModelList } from '../llm/providers';

const CLIENTS = new Set<(event: string, data: unknown) => void>();

export function startWebServer(
  orchestrator: Orchestrator,
  port = 3456,
): http.Server {
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    // API endpoints
    if (req.url === '/api/chat' && req.method === 'POST') {
      handleChat(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/models' && req.method === 'GET') {
      handleModels(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
      handleStatus(req, res, orchestrator);
      return;
    }
    if (req.url === '/ws') {
      handleWebSocket(req, res, orchestrator);
      return;
    }
    // Serve static files
    serveStatic(req, res);
  });

  // Send events to all WebSocket clients
  orchestrator.setEventEmitter((event: AgentEvent) => {
    for (const send of CLIENTS) {
      send('event', event);
    }
  });

  orchestrator.setStreamCallback((text: string) => {
    for (const send of CLIENTS) {
      send('stream', { content: text });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  Dashboard: http://127.0.0.1:${port}/dashboard.html\n`);
  });

  return server;
}

// ===== HANDLERS =====

async function handleChat(req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  try {
    const body = await readBody(req);
    const { message } = JSON.parse(body);
    if (!message) { res.writeHead(400); res.end('missing message'); return; }

    const response = await orch.handleMessage(message);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response, model: orch.getCurrentModel(), tokens: orch.getStats() }));
  } catch (e: unknown) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
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

function handleStatus(_req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ model: orch.getCurrentModel(), stats: orch.getStats() }));
}

function handleWebSocket(_req: IncomingMessage, res: ServerResponse, orch: Orchestrator) {
  // Simulated WebSocket via SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  CLIENTS.add(send);
  send('init', { model: orch.getCurrentModel(), stats: orch.getStats() });

  res.on('close', () => {
    CLIENTS.delete(send);
  });
}

// ===== STATIC FILES =====

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const staticDir = path.join(__dirname, '..', 'server', 'public');
  const fullPath = path.join(staticDir, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(staticDir)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath);
      const mime = getMime(fullPath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } else {
      // Fallback to index.html for SPA routing
      const indexFile = path.join(staticDir, 'index.html');
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
  });
}
