// src/index.ts
// ULTRON v5 — Neural Intelligence Platform (CLI + Desktop)

import { runCLI } from './cli/app';
import { startWebServer } from './server/index';
import { Orchestrator } from './agents/orchestrator';
import { loadEnv } from './shared/utils';
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

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project': case '-p': projectDir = path.resolve(args[++i] || projectDir); break;
      case '--vault': case '-v': vaultDir = path.resolve(args[++i] || vaultDir); break;
      case '--env': case '-e': envFile = path.resolve(args[++i] || ''); break;
      case '--serve': startServer = true; break;
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
  --serve               Start internal server for desktop app
  --port <n>            Server port (default: 3456)
  --bind <addr>         Listen address (default: 127.0.0.1)
  --trust-proxy         Trust X-Forwarded-For headers
  --api-key <key>       API key for server auth
  -h, --help            This help

Default mode: Interactive CLI terminal

Desktop app: Use ULTRON Desktop installer (MSI/NSIS)
  Starts server automatically — no browser needed`);
        process.exit(0);
    }
  }

  loadEnv(envFile);

  if (apiKey) console.log('  Auth enabled — API key required for server access');

  const envCheck = validateEnv();
  for (const w of envCheck.warnings) console.warn('  \u26a0', w);
  if (!envCheck.valid) {
    for (const e of envCheck.errors) console.error('  \u2717', e);
    console.error('\n  No API keys configured. Add keys to .env file and retry.\n');
    process.exit(1);
  }

  initDiscovery().catch(() => {});

  const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: !startServer });

  if (startServer) {
    startWebServer(orch, { port: servePort, bindAddr, trustProxy, apiKey });
    console.log(`Server running on http://${bindAddr === '0.0.0.0' ? 'localhost' : bindAddr}:${servePort}`);
    return;
  }

  // Default: interactive CLI
  await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
