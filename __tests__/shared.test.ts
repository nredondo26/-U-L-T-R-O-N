// __tests__/shared.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureDir, loadJSON, saveJSON, sanitizeFilename, loadEnv, getTimestamp } from '../src/shared/utils';
import { ConfigStore } from '../src/shared/config';

const tmpDir = path.join(os.tmpdir(), 'jarvis-test-' + Date.now());

beforeEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); fs.mkdirSync(tmpDir, { recursive: true }); });
afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); });

describe('Utils', () => {
  it('ensureDir creates directory', () => {
    const d = path.join(tmpDir, 'sub', 'deep');
    ensureDir(d);
    expect(fs.existsSync(d)).toBe(true);
  });

  it('loadJSON returns default when file missing', () => {
    expect(loadJSON(path.join(tmpDir, 'nope.json'), { hello: 'world' })).toEqual({ hello: 'world' });
  });

  it('saveJSON and loadJSON roundtrip', () => {
    const f = path.join(tmpDir, 'test.json');
    saveJSON(f, { a: 1, b: [2, 3] });
    expect(loadJSON(f, {})).toEqual({ a: 1, b: [2, 3] });
  });

  it('sanitizeFilename removes special chars', () => {
    expect(sanitizeFilename('test/file.txt')).toBe('test_file.txt');
    expect(sanitizeFilename('hello world!!!')).toBe('hello_world');
    expect(sanitizeFilename('///\\\\\\...')).toBe('note');
  });

  it('getTimestamp returns HH:MM:SS format', () => {
    const ts = getTimestamp();
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('ConfigStore', () => {
  it('creates default config when file missing', () => {
    const store = new ConfigStore(tmpDir);
    expect(store.currentModel).toBe('');
    expect(store.stats.tokens).toBe(0);
    expect(store.stats.requests).toBe(0);
  });

  it('persists and loads model', () => {
    const store1 = new ConfigStore(tmpDir);
    store1.setCurrentModel('deepseek-chat');
    store1.addTokens(100, 50);

    const store2 = new ConfigStore(tmpDir);
    expect(store2.currentModel).toBe('deepseek-chat');
    expect(store2.stats.tokens).toBe(150);
    expect(store2.stats.requests).toBe(1);
  });

  it('persists chat history', () => {
    const store = new ConfigStore(tmpDir);
    store.setChatHistory([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'que tal' },
    ]);
    const store2 = new ConfigStore(tmpDir);
    expect(store2.chatHistory).toEqual([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'que tal' },
    ]);
  });

  it('trims history to 100 messages', () => {
    const store = new ConfigStore(tmpDir);
    const msgs = Array.from({ length: 150 }, (_, i) => ({ role: 'user' as const, content: `msg${i}` }));
    store.setChatHistory(msgs);
    expect(store.chatHistory.length).toBe(100);
    expect(store.chatHistory[0].content).toBe('msg50');
  });

  it('resets turn count', () => {
    const store = new ConfigStore(tmpDir);
    store.addTokens(10, 5);
    store.addTokens(10, 5);
    expect(store.stats.turns).toBe(2);
    store.resetTurnCount();
    expect(store.stats.turns).toBe(0);
  });
});
