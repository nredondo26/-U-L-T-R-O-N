// src/index.ts
// Entry point de J.A.R.V.I.S. v5 - CLI + Web UI

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
  let webPort = 3456;
  let mode: 'default' | 'cli' | 'web' = 'default';
  let bindAddr = '127.0.0.1';
  let trustProxy = false;
  let apiKey = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project': case '-p': projectDir = path.resolve(args[++i] || projectDir); break;
      case '--vault': case '-v': vaultDir = path.resolve(args[++i] || vaultDir); break;
      case '--env': case '-e': envFile = path.resolve(args[++i] || ''); break;
      case '--cli': mode = 'cli'; break;
      case '--web': mode = 'web'; break;
      case '--port': {
        const p = parseInt(args[++i] || '3456', 10);
        if (isNaN(p) || p < 1024 || p > 65535) {
          console.error(`Invalid port: ${args[i]}. Using 3456.`);
          webPort = 3456;
        } else { webPort = p; }
        break;
      }
      case '--bind': bindAddr = args[++i] || '127.0.0.1'; break;
      case '--trust-proxy': trustProxy = true; break;
      case '--api-key': apiKey = args[++i] || ''; break;
      case '--help': case '-h':
        console.log(`ULTRON v5.0.0 — Neural Intelligence Platform\n
Usage: ultron [options]
Options:
  -p, --project <dir>   Project directory (default: current)
  -v, --vault <dir>     Vault directory (default: ./vault)
  -e, --env <file>      .env file
  --web                 Web UI only (http://localhost:3456)
  --cli                 CLI only
  --port <n>            Web UI port (default: 3456)
  --bind <addr>         Listen address (default: 127.0.0.1, use 0.0.0.0 for network)
  --trust-proxy         Trust X-Forwarded-For headers (for reverse proxy)
  --api-key <key>       API key for web auth (or set ULTRON_API_KEY in .env)
  -h, --help            This help
Default: starts both CLI + Web UI\n`);
        process.exit(0);
    }
  }

  loadEnv(envFile);

  if (apiKey) {
    console.log('  \u{1f512} Auth enabled — API key required for web access');
  }

  const envCheck = validateEnv();
  for (const w of envCheck.warnings) console.warn('  \u26a0', w);
  if (!envCheck.valid) {
    for (const e of envCheck.errors) console.error('  \u2717', e);
    console.error('\n  No API keys configured. Set at least one provider key in your .env file.');
    console.error('  Run: cp .env.example .env and edit the file.\n');
    process.exit(1);
  }

  if (!apiKey) {
    console.warn('  \u26a0 ULTRON_API_KEY not set — web dashboard is open without authentication.');
    console.warn('  Set ULTRON_API_KEY in .env or use --api-key to enable auth.\n');
  }

  // Background discovery of available models from each provider
  initDiscovery().catch(() => {});

  const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: mode !== 'web' });

  const serverConfig = { port: webPort, bindAddr, trustProxy, apiKey };

  if (mode === 'web') {
    startWebServer(orch, serverConfig);
    const displayAddr = bindAddr === '0.0.0.0' ? 'localhost' : bindAddr;
    console.log(`J.A.R.V.I.S. v5 Web UI running on http://${displayAddr}:${webPort}`);
    return;
  }

  startWebServer(orch, serverConfig);

  if (mode === 'cli') {
    await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
  } else {
    await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
