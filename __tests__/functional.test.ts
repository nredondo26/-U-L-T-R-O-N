// __tests__/functional.test.ts
// Functional tests: end-to-end integration, API, file ops, sandbox, voice
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadEnv } from '../src/shared/utils';

const tmpDir = path.join(os.tmpdir(), 'jarvis-func-test-' + Date.now());

beforeEach(() => {
  loadEnv();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { build: 'echo ok', test: 'echo test' } }));
  fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'export function hello() { return "world"; }\nexport class Calc { add(a:number,b:number){return a+b} }');
  fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Test Project\nA test project for functional tests.');
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
});

describe('Functional: Orchestrator end-to-end', () => {
  it('creates orchestrator and responds to simple message', async () => {
    if (!process.env.DEEPSEEK_API_KEY) { console.log('  (skipped - no API key)'); return; }
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');

    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 5, verbose: false });
    expect(orch.getCurrentModel()).toBeTruthy();
    expect(orch.getStats().tokens).toBe(0);

    const r = await orch.handleMessage('di hola en 2 palabras');
    expect(r.length).toBeGreaterThan(0);
    expect(r).not.toContain('error');
    expect(r).not.toContain('fallaron');

    // Second message should also work
    const r2 = await orch.handleMessage('di adios en 2 palabras');
    expect(r2.length).toBeGreaterThan(0);
    expect(r2).not.toContain('error');
    expect(r2).not.toContain('fallaron');
  }, 30000);

  it('handles multi-turn conversation with tools', async () => {
    if (!process.env.DEEPSEEK_API_KEY) { console.log('  (skipped - no API key)'); return; }
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');

    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 3, verbose: false });

    // First message: should use tools
    const r1 = await orch.handleMessage('lee el archivo src/app.ts y dime cuantas funciones tiene');
    expect(r1.length).toBeGreaterThan(0);
    expect(r1).not.toContain('Todos los modelos fallaron');

    // Second message: should still work
    const r2 = await orch.handleMessage('que lenguaje es este proyecto?');
    expect(r2.length).toBeGreaterThan(0);
    expect(r2).not.toContain('Todos los modelos fallaron');
  }, 45000);

  it('handles /help command', async () => {
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');
    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 2, verbose: false });

    const r = await orch.handleMessage('/help');
    expect(r).toContain('/help');
    expect(r).toContain('/build');
    expect(r).toContain('/models');
  });

  it('handles /status command', async () => {
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');
    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 2, verbose: false });

    const r = await orch.handleMessage('/status');
    expect(r).toContain('v5.0.0');
  });

  it('handles /models command', async () => {
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');
    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 2, verbose: false });

    const r = await orch.handleMessage('/models');
    expect(r).toContain('deepseek');
  });

  it('model switching works', async () => {
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');
    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 2, verbose: false });

    const current = orch.getCurrentModel();
    const success = orch.setCurrentModel('deepseek-chat');
    expect(success).toBe(true);
    expect(orch.getCurrentModel()).toBe('deepseek-chat');

    // Invalid model should fail
    const fail = orch.setCurrentModel('nonexistent-model-xyz');
    expect(fail).toBe(false);
    expect(orch.getCurrentModel()).toBe('deepseek-chat');
  });

  it('conversation persists between messages', async () => {
    if (!process.env.DEEPSEEK_API_KEY) { console.log('  (skipped - no API key)'); return; }
    const { Orchestrator } = await import('../src/agents/orchestrator');
    const vaultDir = path.join(tmpDir, 'vault');
    const orch = new Orchestrator({ projectDir: tmpDir, vaultDir, maxSteps: 3, verbose: false });

    await orch.handleMessage('mi nombre es TestUser');
    const r = await orch.handleMessage('cual es mi nombre?');
    expect(r.toLowerCase()).toContain('testuser');
  }, 30000);
});

describe('Functional: File operations', () => {
  it('saveToDesktop works', async () => {
    const { saveToDesktop, checkFile } = await import('../src/tools/file-ops');
    const result = saveToDesktop('jarvis-test.txt', 'hello from test');
    expect(result).toContain('Archivo guardado');
    expect(result).toContain('Verificado');

    const check = checkFile('jarvis-test.txt');
    expect(check).toContain('EXISTE');

    // Cleanup
    const desktop = path.join(os.homedir(), 'Desktop', 'jarvis-test.txt');
    if (fs.existsSync(desktop)) fs.unlinkSync(desktop);
  });

  it('saveToFile creates directories', async () => {
    const { saveToFile, checkFile } = await import('../src/tools/file-ops');
    const deep = path.join(tmpDir, 'deep', 'nested', 'file.txt');
    const result = saveToFile(deep, 'deep content');
    expect(result).toContain('Guardado');
    expect(fs.existsSync(deep)).toBe(true);
  });

  it('checkFile reports missing files', async () => {
    const { checkFile } = await import('../src/tools/file-ops');
    const result = checkFile('nonexistent-file-xyz-123.txt');
    expect(result).toContain('NO EXISTE');
  });
});

describe('Functional: Sandbox', () => {
  it('sandbox blocks dangerous commands', async () => {
    const { checkCommand } = await import('../src/tools/sandbox');
    const result = checkCommand('rm -rf /');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('bloqueado');
  });

  it('sandbox allows safe commands', async () => {
    const { checkCommand } = await import('../src/tools/sandbox');
    const result = checkCommand('npm install');
    expect(result.allowed).toBe(true);
  });

  it('sandbox mode switching works', async () => {
    const { setSandboxMode, getSandboxConfig, allowAll, checkCommand } = await import('../src/tools/sandbox');
    setSandboxMode('deny');
    expect(getSandboxConfig().mode).toBe('deny');

    allowAll();
    const result = checkCommand('any-command');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('session-allow-all');

    setSandboxMode('ask');
  });

  it('sandboxedExec runs safe commands', async () => {
    const { sandboxedExec } = await import('../src/tools/sandbox');
    const result = await sandboxedExec('echo test123', tmpDir);
    expect(result).toContain('test123');
  }, 15000);

  it('sandboxedExec blocks dangerous commands', async () => {
    const { sandboxedExec, setSandboxMode } = await import('../src/tools/sandbox');
    setSandboxMode('deny'); // Force deny mode, no session-allow-all
    const result = await sandboxedExec('rm -rf /', tmpDir);
    expect(result).toContain('BLOQUEADO');
    setSandboxMode('ask');
  }, 15000);
});

describe('Functional: Logger', () => {
  it('logger writes to file', async () => {
    const { log, getRecentLogs } = await import('../src/shared/logger');
    log.info('functional test message', { test: true });
    const logs = getRecentLogs(10);
    expect(logs).toContain('functional test message');
  });
});

describe('Functional: Graph learner', () => {
  it('indexProject indexes all files', async () => {
    const { GraphLearner } = await import('../src/agents/graph-learner');
    const { ObsidianVault } = await import('../src/memory/vault');
    const vaultDir = path.join(tmpDir, 'vault');
    const vault = new ObsidianVault(vaultDir);
    const learner = new GraphLearner(vault, tmpDir);

    const result = await learner.indexProject();
    expect(result.files).toBeGreaterThanOrEqual(1);
    expect(result.nodes).toBeGreaterThanOrEqual(2); // file node + class + function

    // Verify vault has notes
    const notes = vault.listNotes();
    expect(notes.length).toBeGreaterThan(0);
  });

  it('buildGraphContext works after indexing', async () => {
    const { GraphLearner } = await import('../src/agents/graph-learner');
    const { ObsidianVault } = await import('../src/memory/vault');
    const vaultDir = path.join(tmpDir, 'vault');
    const vault = new ObsidianVault(vaultDir);
    const learner = new GraphLearner(vault, tmpDir);

    await learner.indexFile('src/app.ts');
    const ctx = learner.buildGraphContext('hello');
    expect(ctx.length).toBeGreaterThan(0);
  });
});

describe('Functional: Automation', () => {
  it('keyboard tools return OK', async () => {
    const { keyboardPress, keyboardType, mouseClick } = await import('../src/tools/automation');
    const r1 = await keyboardPress('ctrl+s');
    expect(r1).toBe('OK');

    const r2 = await keyboardType('test');
    expect(r2).toBe('OK');

    const r3 = await mouseClick('left');
    expect(r3).toBe('OK');
  }, 15000);

  it('getScreenInfo returns data', async () => {
    const { getScreenInfo } = await import('../src/tools/automation');
    const info = await getScreenInfo();
    expect(typeof info).toBe('string');
    expect(info.length).toBeGreaterThan(0);
  }, 15000);
});

describe('Functional: Voice', () => {
  it('speak returns OK', async () => {
    const { speak } = await import('../src/tools/voice');
    const r = await speak('test', 'default');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  }, 15000);
});

describe('Functional: Config persistence', () => {
  it('config persists between instances', async () => {
    const { ConfigStore } = await import('../src/shared/config');
    const configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(configDir, { recursive: true });

    const c1 = new ConfigStore(configDir);
    c1.setCurrentModel('deepseek-chat');
    c1.addTokens(100, 50);
    c1.setChatHistory([{ role: 'user', content: 'hola' }]);

    const c2 = new ConfigStore(configDir);
    expect(c2.currentModel).toBe('deepseek-chat');
    expect(c2.stats.tokens).toBe(150);
    expect(c2.chatHistory.length).toBe(1);
  });
});

describe('Functional: Document analysis', () => {
  it('analyzes XLSX if present', async () => {
    // Skip if no xlsx file
    if (!fs.existsSync(path.join(tmpDir, 'test.xlsx'))) {
      console.log('  (skipped - no xlsx file)');
      return;
    }
    const { analyzeDocument } = await import('../src/tools/document');
    const result = await analyzeDocument(path.join(tmpDir, 'test.xlsx'));
    expect(result.success).toBe(true);
  });
});
