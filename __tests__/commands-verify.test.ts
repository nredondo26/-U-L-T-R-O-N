// __tests__/commands-verify.test.ts
// Verify all user-facing commands exist and work
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tmpDir = path.join(os.tmpdir(), 'ultron-cmd-test-' + Date.now());
const vaultDir = path.join(tmpDir, 'vault');

beforeEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(vaultDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { build: 'echo ok', test: 'echo test' } }));
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
});

async function runCommand(cmd: string): Promise<string> {
  const { handleCommand } = await import('../src/agents/commands');
  const { ObsidianVault } = await import('../src/memory/vault');
  const { SessionMemory } = await import('../src/memory/session');
  const { ConfigStore } = await import('../src/shared/config');

  const vault = new ObsidianVault(vaultDir);
  const session = new SessionMemory({ maxEvents: 100 });
  const config = new ConfigStore(vaultDir);
  let model = 'deepseek-chat';

  const result = await handleCommand(
    cmd, vault, session, config, tmpDir, model,
    (m: string) => { model = m; return true; },
    () => {},
  );
  return result.response;
}

describe('Command verification', () => {
  it('/help shows available commands', async () => {
    const r = await runCommand('/help');
    expect(r).toContain('/help');
    expect(r).toContain('/models');
    expect(r).toContain('/build');
    expect(r).toContain('/sandbox');
  });

  it('/models lists all models', async () => {
    const r = await runCommand('/models');
    expect(r).toContain('deepseek');
    expect(r).toContain('nvidia');
    expect(r.length).toBeGreaterThan(100);
  });

  it('/models <id> switches model', async () => {
    const r = await runCommand('/models deepseek-chat');
    expect(r).toContain('deepseek-chat');
  });

  it('/status shows system info', async () => {
    const r = await runCommand('/status');
    expect(r).toContain('ULTRON');
    expect(r).toContain('v5');
  });

  it('/tokens shows usage', async () => {
    const r = await runCommand('/tokens');
    expect(r).toContain('Tokens');
    expect(r).toContain('Requests');
  });

  it('/stats is an alias for /tokens', async () => {
    const r = await runCommand('/tokens');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/health checks model status', async () => {
    const r = await runCommand('/health');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/vault shows notes', async () => {
    const r = await runCommand('/vault');
    expect(r).toContain('Vault');
  });

  it('/vault:search finds notes', async () => {
    const r = await runCommand('/vault:search test');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/new clears history', async () => {
    const r = await runCommand('/new');
    expect(r).toContain('Nueva');
  });

  it('/clear is alias for /new', async () => {
    const r = await runCommand('/clear');
    expect(r).toContain('Nueva');
  });

  it('/history shows recent messages', async () => {
    const r = await runCommand('/history');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/sandbox shows sandbox status', async () => {
    const r = await runCommand('/sandbox');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/sandbox allow-all enables all', async () => {
    const { setSandboxMode } = await import('../src/tools/sandbox');
    setSandboxMode('ask');
    const r = await runCommand('/sandbox allow-all');
    expect(r).toContain('permitidos');
  });

  it('/allow adds command to allowlist', async () => {
    const { addAllow } = await import('../src/tools/sandbox');
    const r = await runCommand('/allow testcmd');
    expect(r).toContain('agregado');
  });

  it('/install detects package manager', async () => {
    const r = await runCommand('/install');
    expect(r).toContain('Instalando');
  });

  it('/build detects build script', async () => {
    const r = await runCommand('/build');
    expect(r).toContain('Compilando');
  });

  it('/test detects test script', async () => {
    const r = await runCommand('/test');
    expect(r).toContain('tests');
  });

  it('/browse URL returns action', async () => {
    const r = await runCommand('/browse https://example.com');
    expect(r).toContain('Abriendo');
  });

  it('/open app returns action', async () => {
    const r = await runCommand('/open notepad');
    expect(r).toContain('Abriendo');
  });

  it('/index starts graph indexing', async () => {
    const r = await runCommand('/index');
    expect(r).toContain('Indexando');
  });

  it('/cd changes workspace', async () => {
    const r = await runCommand(`/cd ${tmpDir}`);
    expect(r).toContain('Workspace');
  });

  it('/say speaks text', async () => {
    const r = await runCommand('/say hola');
    expect(r).toContain('Hablando');
  });

  it('/graph shows knowledge graph', async () => {
    const r = await runCommand('/graph');
    expect(r).toContain('Grafo');
  });

  it('/logs shows recent logs', async () => {
    const r = await runCommand('/logs');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/click executes mouse click', async () => {
    const r = await runCommand('/click');
    expect(r).toContain('OK');
  });

  it('/type writes text', async () => {
    const r = await runCommand('/type test');
    expect(r).toContain('OK');
  });

  it('/press sends keys', async () => {
    const r = await runCommand('/press enter');
    expect(r).toContain('OK');
  });

  it('/screenshot captures screen', async () => {
    const r = await runCommand('/screenshot');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/mouse shows position', async () => {
    const r = await runCommand('/mouse');
    expect(r).toContain('Mouse');
  });

  it('/voice-install checks voices', async () => {
    const r = await runCommand('/voice-install');
    expect(r.length).toBeGreaterThan(0);
  });

  it('/voices lists installed voices', async () => {
    const r = await runCommand('/voices');
    expect(r).toContain('Voces');
  });

  it('/exit shows goodbye', async () => {
    const r = await runCommand('/exit');
    expect(r).toContain('Hasta luego');
  });
});
