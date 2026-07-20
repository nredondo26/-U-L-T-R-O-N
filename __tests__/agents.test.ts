// __tests__/agents.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleCommand, isSlashCommand } from '../src/agents/commands';
import { ObsidianVault } from '../src/memory/vault';
import { SessionMemory } from '../src/memory/session';
import { ConfigStore } from '../src/shared/config';

const tmpDir = path.join(os.tmpdir(), 'jarvis-agent-test-' + Date.now());
const vaultDir = path.join(tmpDir, 'vault');

function setup() {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(vaultDir, { recursive: true });

  // Create package.json for install/build/test detection
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    scripts: { build: 'echo build', test: 'jest' },
  }));

  const vault = new ObsidianVault(vaultDir);
  const session = new SessionMemory({ maxEvents: 100 });
  const config = new ConfigStore(vaultDir);
  let model = 'deepseek-chat';
  const setModel = (m: string) => { model = m; return true; };
  return { vault, session, config, model, setModel, clearHistory: () => {} };
}

afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); });

describe('isSlashCommand', () => {
  it('detects slash commands', () => {
    expect(isSlashCommand('/help')).toBe(true);
    expect(isSlashCommand('/models llama')).toBe(true);
    expect(isSlashCommand('!git status')).toBe(true);
  });

  it('rejects normal text', () => {
    expect(isSlashCommand('hola')).toBe(false);
    expect(isSlashCommand('compila este proyecto')).toBe(false);
  });
});

describe('handleCommand', () => {
  it('returns help text', async () => {
    const ctx = setup();
    const result = await handleCommand('/help', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('/help');
    expect(result.response).toContain('/build');
  });

  it('detects install command for npm project', async () => {
    const ctx = setup();
    const result = await handleCommand('/install', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('Instalando');
    expect(result.action).not.toBeUndefined();
    expect(result.action!.command).toMatch(/install/);
  });

  it('detects build command', async () => {
    const ctx = setup();
    const result = await handleCommand('/build', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('Compilando');
    expect(result.action!.command).toBe('npm run build');
  });

  it('detects test command', async () => {
    const ctx = setup();
    const result = await handleCommand('/test', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('tests');
    expect(result.action!.command).toBe('npm test');
  });

  it('browse command returns action', async () => {
    const ctx = setup();
    const result = await handleCommand('/browse https://github.com', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.action!.type).toBe('browse');
    expect(result.action!.command).toBe('https://github.com');
  });

  it('open command returns action', async () => {
    const ctx = setup();
    const result = await handleCommand('/open notepad', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.action!.type).toBe('open');
    expect(result.action!.command).toBe('notepad');
  });

  it('new clears session', async () => {
    const ctx = setup();
    ctx.session.record('test', 'data');
    const result = await handleCommand('/new', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('Nueva');
    expect(ctx.session.getRecent(10).length).toBe(0);
  });

  it('tokens shows stats', async () => {
    const ctx = setup();
    ctx.config.addTokens(100, 50);
    const result = await handleCommand('/tokens', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('150');
  });

  it('status shows info', async () => {
    const ctx = setup();
    const result = await handleCommand('/status', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('v5.0.0');
  });

  it('vault shows notes', async () => {
    const ctx = setup();
    ctx.vault.writeNote('test', 'content');
    const result = await handleCommand('/vault', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('test');
  });

  it('unknown command returns error', async () => {
    const ctx = setup();
    const result = await handleCommand('/unknown', ctx.vault, ctx.session, ctx.config, tmpDir, ctx.model, ctx.setModel, ctx.clearHistory);
    expect(result.response).toContain('desconocido');
  });
});
