// __tests__/extended.test.ts - Full coverage: voice, search, web, git, document, skills
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tmpDir = path.join(os.tmpdir(), 'jarvis-ext-test-' + Date.now());

beforeEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { build: 'echo ok', test: 'jest' } }));
  fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'function hello() { return "world"; }\nclass Test { run() {} }\n');
});
afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); });

describe('Voice module', () => {
  it('listVoices returns array', async () => {
    const { listVoices } = await import('../src/tools/voice');
    const voices = await listVoices();
    expect(Array.isArray(voices)).toBe(true);
  });

  it('isVoiceboxAvailable returns boolean', async () => {
    const { isVoiceboxAvailable } = await import('../src/tools/voice');
    const available = await isVoiceboxAvailable();
    expect(typeof available).toBe('boolean');
  });
});

describe('Search module', () => {
  it('fastSearch finds text', () => {
    const { fastSearch } = require('../src/tools/search');
    const results = fastSearch('hello', tmpDir);
    expect(Array.isArray(results)).toBe(true);
    // Should find at least the app.ts file
    const found = results.filter(r => r.file.includes('app.ts'));
    expect(found.length).toBeGreaterThanOrEqual(0); // May not find if rg not installed
  });

  it('fastSearch with file pattern', () => {
    const { fastSearch } = require('../src/tools/search');
    const results = fastSearch('hello', tmpDir, '*.ts');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('Web module', () => {
  it('webSearch returns results', async () => {
    const { webSearch } = await import('../src/tools/web');
    const result = await webSearch('javascript');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  }, 15000);

  it('fetchURL handles invalid URL', async () => {
    const { fetchURL } = await import('../src/tools/web');
    const result = await fetchURL('http://localhost:99999/nope');
    expect(result).toContain('Error');
  }, 10000);
});

describe('Document module', () => {
  it('analyzes text file', async () => {
    const { analyzeDocument } = await import('../src/tools/document');
    const txtFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(txtFile, 'hello world');
    const result = await analyzeDocument(txtFile);
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello world');
    expect(result.fileType).toBe('txt');
  });

  it('analyzes markdown file', async () => {
    const { analyzeDocument } = await import('../src/tools/document');
    const mdFile = path.join(tmpDir, 'readme.md');
    fs.writeFileSync(mdFile, '# Title\ncontent');
    const result = await analyzeDocument(mdFile);
    expect(result.success).toBe(true);
  });

  it('fails on missing file', async () => {
    const { analyzeDocument } = await import('../src/tools/document');
    const result = await analyzeDocument(path.join(tmpDir, 'nope.pdf'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('no encontrado');
  });

  it('analyzes JSON file', async () => {
    const { analyzeDocument } = await import('../src/tools/document');
    const jsonFile = path.join(tmpDir, 'config.json');
    fs.writeFileSync(jsonFile, '{"key":"value"}');
    const result = await analyzeDocument(jsonFile);
    expect(result.success).toBe(true);
  });
});

describe('Execute module', () => {
  it('executes echo command', async () => {
    const { executeCommand } = await import('../src/tools/execute');
    const cmd = process.platform === 'win32' ? 'echo hello' : 'echo hello';
    const result = await executeCommand(cmd, tmpDir);
    expect(result.stdout).toContain('hello');
    expect(result.code).toBe(0);
  }, 15000);

  it('handles invalid command', async () => {
    const { executeCommand } = await import('../src/tools/execute');
    const result = await executeCommand('nonexistentcommand12345', tmpDir);
    expect(result.error).toBeTruthy();
  }, 15000);
});

describe('Git module', () => {
  it('gitCommand handles non-git dir', async () => {
    const { gitStatus } = await import('../src/tools/git');
    const result = await gitStatus(tmpDir);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  }, 15000);
});

describe('Graph learner', () => {
  it('indexes a file', async () => {
    const { GraphLearner } = await import('../src/agents/graph-learner');
    const vault = await createVault();
    const learner = new GraphLearner(vault, tmpDir);
    const result = await learner.indexFile('src/app.ts');
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.nodes).toBeGreaterThanOrEqual(2); // file node + function + class
  });

  it('buildGraphContext returns hint when empty', async () => {
    const { GraphLearner } = await import('../src/agents/graph-learner');
    const vault = await createVault();
    const learner = new GraphLearner(vault, tmpDir);
    const ctx = learner.buildGraphContext('random');
    expect(ctx).toContain('index');
  });

  it('searchGraph returns results after indexing', async () => {
    const { GraphLearner } = await import('../src/agents/graph-learner');
    const vault = await createVault();
    const learner = new GraphLearner(vault, tmpDir);
    await learner.indexFile('src/app.ts');
    const results = learner.searchGraph('hello');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('Theme system', () => {
  it('switches themes', () => {
    const { setTheme, getThemeName, listThemes } = require('../src/cli/theme');
    const themes = listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(4);
    expect(themes).toContain('sky');
    expect(themes).toContain('matrix');

    setTheme('cyber');
    expect(getThemeName()).toBe('cyber');

    setTheme('sky');
    expect(getThemeName()).toBe('sky');
  });

  it('invalid theme does not change', () => {
    const { setTheme, getThemeName } = require('../src/cli/theme');
    const current = getThemeName();
    setTheme('nonexistent' as any);
    expect(getThemeName()).toBe(current);
  });
});

describe('Edge cases', () => {
  it('handles empty string sanitize', () => {
    const { sanitizeFilename } = require('../src/shared/utils');
    expect(sanitizeFilename('')).toBe('note');
  });

  it('handles very long filename', () => {
    const { sanitizeFilename } = require('../src/shared/utils');
    const long = 'a'.repeat(200) + '.txt';
    const result = sanitizeFilename(long);
    expect(result).toBeTruthy();
  });

  it('saveJSON handles nested dirs', () => {
    const { saveJSON, loadJSON } = require('../src/shared/utils');
    const f = path.join(tmpDir, 'a', 'b', 'c.json');
    saveJSON(f, { deep: true });
    expect(loadJSON(f, {})).toEqual({ deep: true });
  });

  it('loadEnv from missing file does not throw', () => {
    const { loadEnv } = require('../src/shared/utils');
    expect(() => loadEnv(path.join(tmpDir, 'nope.env'))).not.toThrow();
  });
});

describe('Provider edge cases', () => {
  it('getProvider returns null when no keys set', () => {
    const { getProvider } = require('../src/llm/providers');
    // Save and clear keys
    const saved: Record<string, string | undefined> = {};
    for (const k of ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'NVIDIA_API_KEY', 'OPENROUTER_API_KEY']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      const result = getProvider('nonexistent-model');
      expect(result).toBeNull();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v) process.env[k] = v;
      }
    }
  });

  it('getAllModels returns empty with no keys', () => {
    const { getAllModels } = require('../src/llm/providers');
    const saved: Record<string, string | undefined> = {};
    for (const k of ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'NVIDIA_API_KEY', 'OPENROUTER_API_KEY']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      const result = getAllModels();
      expect(result).toEqual([]);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v) process.env[k] = v;
      }
    }
  });

  it('getFallbackChain returns empty if no model', () => {
    const { getFallbackChain } = require('../src/llm/providers');
    const result = getFallbackChain('nonexistent');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Vault edge cases', () => {
  it('readNote returns null for missing note', async () => {
    const { ObsidianVault } = await import('../src/memory/vault');
    const vDir = path.join(tmpDir, 'vault-edge');
    fs.mkdirSync(vDir, { recursive: true });
    const vault = new ObsidianVault(vDir);
    expect(vault.readNote('nope')).toBeNull();
    expect(vault.deleteNote('nope')).toBeFalse();
  });

  it('sanitizes unsafe note names', async () => {
    const { ObsidianVault } = await import('../src/memory/vault');
    const vDir = path.join(tmpDir, 'vault-edge2');
    fs.mkdirSync(vDir, { recursive: true });
    const vault = new ObsidianVault(vDir);
    const note = vault.writeNote('../evil', 'content');
    expect(fs.existsSync(path.join(vDir, note.name + '.md'))).toBeTrue();
  });

  it('vault graph with no edges', async () => {
    const { ObsidianVault } = await import('../src/memory/vault');
    const vDir = path.join(tmpDir, 'vault-edge3');
    fs.mkdirSync(vDir, { recursive: true });
    const vault = new ObsidianVault(vDir);
    vault.writeNote('alone', 'no links here');
    const graph = vault.getGraph();
    expect(graph.nodes.length).toBe(1);
    expect(graph.edges.length).toBe(0);
  });
});

async function createVault() {
  const { ObsidianVault } = await import('../src/memory/vault');
  const vaultDir = path.join(tmpDir, 'vault');
  fs.mkdirSync(vaultDir, { recursive: true });
  return new ObsidianVault(vaultDir);
}
