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
  -h, --help            This help
Default: starts both CLI + Web UI\n`);
        process.exit(0);
    }
  }

  loadEnv(envFile);

  const envCheck = validateEnv();
  for (const w of envCheck.warnings) console.warn('  ⚠', w);
  if (!envCheck.valid) {
    for (const e of envCheck.errors) console.error('  ✗', e);
  }

  // Background discovery of available models from each provider
  initDiscovery().catch(() => {});

  const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: mode !== 'web' });

  if (mode === 'web') {
    startWebServer(orch, webPort);
    console.log(`J.A.R.V.I.S. v5 Web UI running on http://127.0.0.1:${webPort}`);
    return;
  }

  // Start web server in background (for default + --cli mode with dashboard)
  startWebServer(orch, webPort);

  if (mode === 'cli') {
    await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
  } else {
    // Default: both CLI + Web
    await runCLI({ projectDir, vaultDir, envFile, orchestrator: orch });
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
