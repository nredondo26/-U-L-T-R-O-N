// src/index.ts
// Entry point de J.A.R.V.I.S. v5 - CLI + Web UI

import { runCLI } from './cli/app';
import { startWebServer } from './server/index';
import { Orchestrator } from './agents/orchestrator';
import { loadEnv } from './shared/utils';
import * as path from 'path';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let projectDir = process.cwd();
  let vaultDir = path.join(process.cwd(), 'vault');
  let envFile: string | undefined;
  let webMode = false;
  let webPort = 3456;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project': case '-p': projectDir = path.resolve(args[++i] || projectDir); break;
      case '--vault': case '-v': vaultDir = path.resolve(args[++i] || vaultDir); break;
      case '--env': case '-e': envFile = path.resolve(args[++i] || ''); break;
      case '--web': webMode = true; break;
      case '--port': webPort = parseInt(args[++i] || '3456', 10); break;
      case '--help': case '-h':
        console.log(`ULTRON v5.0.0 — Neural Intelligence Platform\n
Usage: ultron [options]
Options:
  -p, --project <dir>   Project directory (default: current)
  -v, --vault <dir>     Vault directory (default: ./vault)
  -e, --env <file>      .env file
  --web                 Start web UI (http://localhost:3456)
  --port <n>            Web UI port (default: 3456)
  -h, --help            This help\n`);
        process.exit(0);
    }
  }

  if (webMode) {
    // Web-only mode
    loadEnv(envFile);
    const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: false });
    startWebServer(orch, webPort);
    console.log(`J.A.R.V.I.S. v5 Web UI running on http://127.0.0.1:${webPort}`);
  } else {
    // CLI mode (default)
    await runCLI({ projectDir, vaultDir, envFile });
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
