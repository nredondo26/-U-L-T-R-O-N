// src/cli/app.ts
// CLI clean minimal design

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { Orchestrator } from '../agents/orchestrator';
import { loadEnv } from '../shared/utils';
import { getProviders, getAllModels, getHealthyModelList, getModelsForHealthCheck } from '../llm/providers';
import { runHealthCheck, getHealthSummary } from '../llm/health';
import { analyzeDocument } from '../tools/document';
import type { AgentEvent } from '../agents/types';
import {
  welcome, hr, formatResponse, formatSlashResponse,
  formatAgentAction, formatAgentResult,
  Spinner, printSelectMenu, showTokens, footer,
  resetStreamState, promptText, promptModel,
  setTheme, getThemeName, listThemes,
} from './display';
import type { SelectOption } from './display';

function ask(rl: readline.Interface, q: string): Promise<boolean> {
  return new Promise(resolve => {
    rl.question(q, a => resolve(['s','si','y','yes'].includes(a.trim().toLowerCase())));
  });
}

export async function runCLI(options: {
  projectDir?: string; vaultDir?: string; envFile?: string;
}): Promise<void> {
  loadEnv(options.envFile);
  const projectDir = options.projectDir || process.cwd();
  const vaultDir = options.vaultDir || path.join(projectDir, 'vault');
  const providers = getProviders();
  const orch = new Orchestrator({ projectDir, vaultDir, maxSteps: 25, verbose: true });
  const stats = orch.getStats();

  console.log(welcome(providers.map(p => p.name), orch.getCurrentModel(), stats.tokens, stats.requests, stats.history, getThemeName()));

  // Silent background health check (no startup delay)
  const modelsToCheck = getModelsForHealthCheck();
  const prevSummary = getHealthSummary();
  if (modelsToCheck.length > 0 && (!prevSummary.lastCheck || Date.now() - new Date(prevSummary.lastCheck).getTime() > 3600000)) {
    runHealthCheck(modelsToCheck).catch(() => {});
  }

  let spinner: Spinner | null = null;
  let wasStreamed = false;
  let verboseMode = true; // Show agent activity by default

  orch.setEventEmitter((event: AgentEvent) => {
    if (event.type === 'thought') {
      if (spinner) spinner.updateMessage(event.message);
      else { spinner = new Spinner(event.agent, event.message); spinner.start(); }
    } else if (event.type === 'action') {
      if (spinner) { spinner.stop(); spinner = null; }
      if (verboseMode) {
        const label = event.data
          ? String((event.data as Record<string,unknown>).command || (event.data as Record<string,unknown>).task || (event.data as Record<string,unknown>).filePath || event.message).slice(0, 50)
          : event.message;
        process.stdout.write(`  ${TC('dim')('[')}${TC('accent')(event.agent.slice(0,8))}${TC('dim')(']')} ${TC('dim')(label)}\n`);
      }
      spinner = new Spinner(event.agent, event.message); spinner.start();
    } else if (event.type === 'done') {
      if (spinner) { spinner.stop(); spinner = null; }
    }
  });

  orch.setStreamCallback((text: string) => {
    if (spinner) { spinner.stop(); spinner = null; }
    if (!wasStreamed) { process.stdout.write('\n'); resetStreamState(); }
    wasStreamed = true;
    process.stdout.write(text);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: promptText(), terminal: true });
  rl.prompt();

  let busy = false;
  let pendingModels: SelectOption[] | null = null;

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (pendingModels) {
      const n = parseInt(input, 10);
      if (!isNaN(n) && n >= 1 && n <= pendingModels.length) orch.setCurrentModel(pendingModels[n - 1].value);
      pendingModels = null;
      rl.setPrompt(promptText()); rl.prompt();
      return;
    }

    if (!input) { rl.prompt(); return; }
    if (busy) { console.log('    ...'); rl.prompt(); return; }

    // !bash
    if (input.startsWith('!')) {
      busy = true; wasStreamed = false; spinner = null;
      console.log('\n' + hr());
      try {
        const r = await orch.handleMessage(input);
        if (!wasStreamed) console.log(r);
        await repair(rl, orch, r, input.slice(1).trim(), input, wasStreamed);
      } catch (e: unknown) { console.log('    error: ' + (e instanceof Error ? e.message : String(e))); }
      console.log(footer(orch.getStats().tokens, orch.getStats().requests, orch.getCurrentModel()));
      busy = false; rl.prompt();
      return;
    }

    // /slash commands
    if (input.startsWith('/')) {
      const sp = input.indexOf(' ');
      const cmd = sp > 0 ? input.slice(1, sp).toLowerCase() : input.slice(1).toLowerCase();
      const args = sp > 0 ? input.slice(sp + 1).trim() : '';

      switch (cmd) {
        case 'help': console.log(formatSlashResponse(await orch.handleMessage(input))); break;
        case 'exit': case 'quit': console.log('\n    goodbye.\n'); rl.close(); process.exit(0);
        case 'models': {
          const allModels = getAllModels();
          const healthySet = new Set(getHealthyModelList().map(m => m.model));
          const current = orch.getCurrentModel();
          // Show all models, mark unhealthy ones
          const opts: SelectOption[] = allModels.map(m => ({
            label: healthySet.has(m.model) ? m.model : m.model + ' [down]',
            value: m.model,
            group: m.provider,
          }));
          printSelectMenu('select model', opts, current);
          pendingModels = allModels.map(m => ({ label: m.model, value: m.model, group: m.provider }));
          rl.setPrompt(promptModel()); break;
        }
        case 'theme': {
          if (args && listThemes().includes(args.toLowerCase())) {
            setTheme(args.toLowerCase() as 'ultron'|'sky'|'cyber'|'midnight'|'matrix');
            console.log('    theme: ' + args);
          } else {
            console.log('    themes: ' + listThemes().join(', '));
          } break;
        }
        case 'verbose': {
          verboseMode = !verboseMode;
          console.log(`    verbose: ${verboseMode ? 'ON (shows agent activity)' : 'OFF (quiet mode)'}`);
          break;
        }
        case 'quiet': {
          verboseMode = false;
          console.log('    quiet mode ON');
          break;
        }
        case 'init': {
          busy = true; wasStreamed = false; spinner = null;
          console.log('\n' + hr());
          try {
            const r = await orch.handleMessage('Crea knowledge.md con nombre, proposito, arquitectura, tecnologias y estructura de este proyecto. Usa write_file. No preguntes.');
            if (!wasStreamed) console.log(formatResponse(r));
            console.log('    ' + TC('success')('knowledge.md created'));
      } catch (e: unknown) { console.log('    error: ' + (e instanceof Error ? e.message : String(e))); }
          console.log(footer(orch.getStats().tokens, orch.getStats().requests, orch.getCurrentModel()));
          busy = false; break;
        }
        case 'install': case 'build': case 'test': case 'index': case 'cd': case 'say':
        case 'click': case 'type': case 'press': case 'screenshot': case 'mouse':
        case 'model': case 'health': case 'graph': case 'stats': case 'allow': case 'clear': case 'verbose': case 'quiet': {
          const r = await orch.handleMessage(input);
          console.log(formatSlashResponse(r));
          break;
        }
        case 'dashboard': {
          const { exec } = await import('child_process');
          exec('start http://127.0.0.1:3456/dashboard.html');
          console.log('    opening agent dashboard...');
          break;
        }
        case 'browse': case 'open':
        case 'status': case 'tokens': case 'history':
        case 'vault': case 'vault:search': {
          const r = await orch.handleMessage(input);
          console.log(formatSlashResponse(r));
          break;
        }
        case 'analyze': {
          if (!args) { console.log('    usage: /analyze <file.pdf>'); break; }
          console.log('\n' + hr());
          const r = await analyzeDocument(path.resolve(projectDir, args));
          if (!r.success) { console.log('    ' + TC('error')(r.error || 'error')); }
          else {
            console.log(`    ${TC('bright')(r.fileName)}  ${TC('dim')(`${r.fileType.toUpperCase()} · ${r.charCount.toLocaleString()} chars`)}`);
            console.log('\n' + r.content.slice(0, 5000));
          }
          console.log(footer(orch.getStats().tokens, orch.getStats().requests, orch.getCurrentModel()));
          break;
        }
        default: console.log(formatSlashResponse(await orch.handleMessage(input)));
      }
      rl.prompt();
      return;
    }

    // Normal message
    busy = true; wasStreamed = false; spinner = null;
    console.log('\n' + hr());

    try {
      const r = await orch.handleMessage(input);
      if (!wasStreamed) console.log(formatResponse(r));
    } catch (e: unknown) {
      const s = spinner as Spinner | null; s?.stop(); spinner = null;
      console.log('    ' + TC('error')((e instanceof Error ? e.message : String(e)).split('\n')[0]));
    }

    console.log(footer(orch.getStats().tokens, orch.getStats().requests, orch.getCurrentModel()));
    busy = false; rl.prompt();
  });

  rl.on('close', () => { console.log('\n    offline.\n'); process.exit(0); });
  rl.on('SIGINT', () => { if (busy) console.log('\n    processing...'); else { console.log('\n    goodbye.\n'); rl.close(); } });
}

async function repair(rl: readline.Interface, orch: Orchestrator, out: string, action: string, input: string, wasStreamed: boolean): Promise<void> {
  if (!/error|fail|FAIL|Error:|ENOENT|cannot find/i.test(out)) return;
  console.log('\n    ' + TC('warn')('build failed.'));
  if (!await ask(rl, `    analyze & fix? (y/n) `)) return;

  const fix = await orch.handleMessage(
    `El comando "${action}" fallo con:\n\n${out.slice(0, 3000)}\n\nAnaliza el error. PROPONE el fix, NO modifiques nada aun. Se especifico.`
  );
  if (!wasStreamed) console.log(formatResponse(fix));
  if (!await ask(rl, `    apply fix? (y/n) `)) return;

  await orch.handleMessage('Aplica los cambios. Usa las herramientas necesarias. No preguntes.');
  console.log('\n' + hr());
  const retry = await orch.handleMessage(input);
  console.log(formatSlashResponse(retry));
}

// Need theme colors for repair
import { getTheme } from './theme';
import chalk from 'chalk';
const TC = (key: keyof ReturnType<typeof getTheme>) => chalk.hex(getTheme()[key]);
