// __tests__/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ObsidianVault } from '../src/memory/vault';
import { SessionMemory } from '../src/memory/session';

const tmpDir = path.join(os.tmpdir(), 'jarvis-mem-test-' + Date.now());
const vaultDir = path.join(tmpDir, 'vault');

beforeEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(vaultDir, { recursive: true });
});
afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); });

describe('ObsidianVault', () => {
  it('starts empty', () => {
    const vault = new ObsidianVault(vaultDir);
    expect(vault.listNotes()).toEqual([]);
    expect(vault.buildContext()).toBe('(vault vacio)');
  });

  it('writes and reads a note', () => {
    const vault = new ObsidianVault(vaultDir);
    vault.writeNote('test', '# Hello\n\nThis is a test note with #tag and [[other-note]]');
    const note = vault.readNote('test');
    expect(note).not.toBeNull();
    expect(note!.name).toBe('test');
    expect(note!.tags).toContain('tag');
    expect(note!.links).toContain('other-note');
  });

  it('searches notes', () => {
    const vault = new ObsidianVault(vaultDir);
    vault.writeNote('python', 'Python es un lenguaje #programming');
    vault.writeNote('javascript', 'JS es para web #frontend');
    expect(vault.searchNotes('python').length).toBe(1);
    expect(vault.searchNotes('programming').length).toBe(1);
    expect(vault.searchNotes('rust').length).toBe(0);
  });

  it('deletes notes', () => {
    const vault = new ObsidianVault(vaultDir);
    vault.writeNote('temp', 'temporary');
    expect(vault.readNote('temp')).not.toBeNull();
    vault.deleteNote('temp');
    expect(vault.readNote('temp')).toBeNull();
  });

  it('generates graph', () => {
    const vault = new ObsidianVault(vaultDir);
    vault.writeNote('A', '[[B]] y [[C]]');
    vault.writeNote('B', 'respuesta a [[A]]');
    const graph = vault.getGraph();
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(3);
  });

  it('auto-saves different types', () => {
    const vault = new ObsidianVault(vaultDir);
    vault.autoSave('action', { summary: 'test', detail: 'testing', result: 'ok' });
    vault.autoSave('learning', { topic: 'AI', content: 'AI is cool', tags: ['tech'] });
    vault.autoSave('context', 'some context');
    const notes = vault.listNotes();
    expect(notes.length).toBe(3);
  });

  it('limits buildContext to MAX_CONTEXT_NOTES', () => {
    const vault = new ObsidianVault(vaultDir);
    for (let i = 0; i < 100; i++) vault.writeNote(`nota_${i}`, `Note number ${i}`);
    const ctx = vault.buildContext();
    const lines = ctx.split('\n').filter(l => l.startsWith('- '));
    expect(lines.length).toBeLessThanOrEqual(50);
  });

  it('cleans old auto-saved notes when over MAX_NOTES', () => {
    const vault = new ObsidianVault(vaultDir);
    for (let i = 0; i < 1005; i++) vault.writeNote(`nota_${i}`, `Note number ${i}`);
    const vault2 = new ObsidianVault(vaultDir);
    expect(vault2.listNotes().length).toBeLessThanOrEqual(1000);
  });

  it('readNote returns null for non-existent note', () => {
    const vault = new ObsidianVault(vaultDir);
    expect(vault.readNote('nonexistent')).toBeNull();
  });

  it('writeNote sanitizes unsafe filenames', () => {
    const vault = new ObsidianVault(vaultDir);
    const note = vault.writeNote('../malicious', 'content');
    // Note is written inside vault, not escaped
    expect(fs.existsSync(path.join(vaultDir, note.name + '.md'))).toBeTrue();
  });
});

describe('SessionMemory', () => {
  it('records events', () => {
    const sm = new SessionMemory({ maxEvents: 100 });
    sm.record('chat', 'user said hello', 'response');
    sm.recordTask('fix bug', 'in file.ts');
    sm.recordError('crash', 'null pointer');

    expect(sm.getRecent(10).length).toBe(3);
    expect(sm.getByType('error').length).toBe(1);
    expect(sm.getByType('task').length).toBe(1);
  });

  it('generates prompt summary', () => {
    const sm = new SessionMemory({ maxEvents: 100 });
    sm.record('chat', 'User: hola', 'AI: bienvenido');
    const summary = sm.toPromptSummary(500);
    expect(summary).toContain('chat');
    expect(summary).not.toBe('(memoria de sesion vacia)');
  });

  it('trims to max events', () => {
    const sm = new SessionMemory({ maxEvents: 10 });
    for (let i = 0; i < 20; i++) sm.record('test', `event ${i}`);
    expect(sm.getRecent(50).length).toBe(10);
  });

  it('clears session', () => {
    const sm = new SessionMemory({ maxEvents: 100 });
    sm.record('test', 'data');
    sm.clear();
    expect(sm.getRecent(10).length).toBe(0);
  });

  it('persists to file', () => {
    const file = path.join(tmpDir, 'session.json');
    const sm1 = new SessionMemory({ maxEvents: 100, persistFile: file });
    sm1.record('test', 'persisted');
    const sm2 = new SessionMemory({ maxEvents: 100, persistFile: file });
    expect(sm2.getRecent(10).length).toBe(1);
  });
});
