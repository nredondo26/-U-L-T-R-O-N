// src/index.ts
// ULTRON v5 — Neural Intelligence Platform (CLI + Desktop + MCP)

import { runCLI } from './cli/app';
import { startWebServer } from './server/index';
import { Orchestrator } from './agents/orchestrator';
import { MCPServer } from './mcp/server';
import { StdioTransport } from './mcp/stdio';
import { loadEnv } from './shared/utils';
import { existsSync, readFileSync } from 'fs';
import { validateEnv } from './shared/validate';
import { initDiscovery } from './llm/providers';
import * as path from 'path';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let projectDir = process.cwd();
  let vaultDir = path.join(process.cwd(), 'vault');
  let envFile: string | undefined;
  let servePort = 3456;
  let bindAddr = '127.0.0.1';
  let trustProxy = false;
  let apiKey = '';
  let startServer = false;
  let mcpMode = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project': case '-p': projectDir = path.resolve(args[++i] || projectDir); break;
      case '--vault': case '-v': vaultDir = path.resolve(args[++i] || vaultDir); break;
      case '--env': case '-e': envFile = path.resolve(args[++i] || ''); break;
      case '--serve': startServer = true; break;
      case '--mcp': mcpMode = true; break;
      case '--port': {
        const p = parseInt(args[++i] || '3456', 10);
        if (isNaN(p) || p < 1024 || p > 65535) { servePort = 3456; }
        else { servePort = p; }
        break;
      }
      case '--bind': bindAddr = args[++i] || '127.0.0.1'; break;
      case '--trust-proxy': trustProxy = true; break;
      case '--api-key': apiKey = args[++i] || ''; break;
      case '--help': case '-h':
        console.log(`ULTRON v5.1.0 — Neural Intelligence Platform

Usage: ultron [options]

Options:
  -p, --project <dir>   Project directory (default: current)
  -v, --vault <dir>     Vault directory (default: ./vault)
  -e, --env <file>      .env file path
  --serve               Start web server (default: interactive CLI)
  --web                 Start web server (alias for --serve)
  --mcp                 Start MCP server (stdio mode for OpenCode/Claude)
  --port <n>            Server port (default: 3456)
  --bind <addr>         Listen address (default: 127.0.0.1)
  --trust-proxy         Trust X-Forwarded-For headers
  --api-key <key>       API key for server auth
  -h, --help            This help

MCP mode:
  ultron --mcp                   # MCP stdio server for OpenCode integration

Web server:
  ultron --web --port 8080       # Web dashboard

Default mode: Interactive CLI terminal`);
        process.exit(0);
    }
  }

  loadEnv(envFile);

  // Fallback: read .env directly if loadEnv didn't work (e.g., in compiled binary)
  if (!process.env.DASHSCOPE_API_KEY && !process.env.DEEPSEEK_API_KEY && !process.env.NVIDIA_API_KEY) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf8');
        for (const rawLine of content.split('\n')) {
          const line = rawLine.trim();
          const eq = line.indexOf('=');
          if (eq > 0) {
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k && v && (k.endsWith('_API_KEY') || k.endsWith('_BASE_URL') || k === 'ULTRON_API_KEY') && !process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    } catch {}
  }

  if (apiKey) console.log('  Auth enabled — API key required for server access');

  const envCheck = validateEnv();
  for (const w of envCheck.warnings) console.warn('  \u26a0', w);
  if (!envCheck.valid) {
    for (const e of envCheck.errors) console.error('  \u2717', e);
    console.error('\n  No API keys configured. Add keys to .env file and retry.\n');
    process.exit(1);
  }

  initDiscovery().catch(() => {});

  const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: mcpMode ? false : !startServer });

  // MCP mode: expose ULTRON tools as MCP stdio server
  if (mcpMode) {
    const mcpServer = orch.getMCPServer();
    await mcpServer.init();
    mcpServer.registerToolsFromDefinitions(getOrchestratorTools());
    const transport = new StdioTransport(mcpServer);
    transport.start();
    return;
  }

  if (startServer) {
    startWebServer(orch, { port: servePort, bindAddr, trustProxy, apiKey, noBrowser: true });
    console.log(`[serve] http://127.0.0.1:${servePort}`);
    return;
  }

  // Default: interactive CLI
  await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
}

// Tool definitions for MCP mode (mirrors orchestrator's getTools)
function getOrchestratorTools() {
  const d = (name: string, desc: string, props: Record<string, unknown> = {}, required: string[] = []): any =>
    ({ type: 'function', function: { name, description: desc, parameters: { type: 'object', properties: props, required } } });
  return [
    d('delegate_editor', 'Edit files', { task: { type: 'string' } }, ['task']),
    d('delegate_librarian', 'Analyze codebase', { task: { type: 'string' } }, ['task']),
    d('delegate_basher', 'Execute commands', { task: { type: 'string' } }, ['task']),
    d('delegate_researcher', 'Search web', { task: { type: 'string' } }, ['task']),
    d('delegate_thinker', 'Plan tasks', { task: { type: 'string' } }, ['task']),
    d('delegate_reviewer', 'Review code', { content: { type: 'string' } }, ['content']),
    d('delegate_architect', 'Plan large projects', { task: { type: 'string' } }, ['task']),
    d('read_file', 'Read file', { filePath: { type: 'string' } }, ['filePath']),
    d('write_file', 'Write file', { filePath: { type: 'string' }, content: { type: 'string' } }, ['filePath', 'content']),
    d('grep', 'Search in files', { query: { type: 'string' } }, ['query']),
    d('str_replace', 'Replace text in file', { filePath: { type: 'string' }, oldStr: { type: 'string' }, newStr: { type: 'string' } }, ['filePath', 'oldStr', 'newStr']),
    d('direct_execute', 'Run command', { command: { type: 'string' } }, ['command']),
    d('direct_search', 'Web search', { query: { type: 'string' } }, ['query']),
    d('graph_search', 'Search graph', { query: { type: 'string' } }, ['query']),
    d('graph_related', 'Related nodes', { node: { type: 'string' } }, ['node']),
    d('graph_compact', 'Compact file view', { file: { type: 'string' } }, ['file']),
    d('graph_overview', 'Project overview', {}, []),
  ];
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
