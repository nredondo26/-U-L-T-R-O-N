// src/server/index.ts
// Web server for ULTRON v5 - web dashboard + streaming API

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { Orchestrator } from '../agents/orchestrator';
import type { AgentEvent } from '../agents/types';
import { getAllModels, getHealthyModelList } from '../llm/providers';

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
    if (req.url === '/api/models' && req.method === 'POST') {
      handleSetModel(req, res, orchestrator);
      return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
      handleStatus(req, res, orchestrator);
      return;
    }
    // Serve static files
    serveStatic(req, res);
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
    const { message, model: requestedModel } = JSON.parse(body);
    if (!message) { res.writeHead(400); res.end('missing message'); return; }

    if (requestedModel) orch.setCurrentModel(requestedModel);

    // SSE streaming mode
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send init
    res.write(JSON.stringify({ type: 'init', model: orch.getCurrentModel(), stats: orch.getStats() }) + '\n');

    let streamBuffer = '';

    // Override callbacks for this request
    const origEvent = (orch as any).onEvent;
    const origStream = (orch as any).onStream;

    (orch as any).onEvent = (event: AgentEvent) => {
      res.write(JSON.stringify({ type: 'event', data: event }) + '\n');
      if (event.type === 'done') res.write(JSON.stringify({ type: 'done' }) + '\n');
    };

    (orch as any).onStream = (text: string) => {
      streamBuffer += text;
      res.write(JSON.stringify({ type: 'stream', content: text }) + '\n');
    };

    const response = await orch.handleMessage(message);

    // Restore
    (orch as any).onEvent = origEvent;
    (orch as any).onStream = origStream;

    res.write(JSON.stringify({ type: 'result', response, model: orch.getCurrentModel(), tokens: orch.getStats() }) + '\n');
    res.end();
  } catch (e: unknown) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`);
    res.end();
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
