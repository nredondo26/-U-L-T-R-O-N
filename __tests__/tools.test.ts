// __tests__/tools.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fileTools from '../src/tools/file';

const tmpDir = path.join(os.tmpdir(), 'jarvis-tools-test-' + Date.now());

beforeEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
});
afterEach(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); });

describe('File tools', () => {
  it('writes and reads files', () => {
    fileTools.writeFile('test.txt', 'hello world', tmpDir);
    expect(fileTools.readFile('test.txt', tmpDir)).toBe('hello world');
  });

  it('reads file range', () => {
    fileTools.writeFile('lines.txt', 'line1\nline2\nline3\nline4\nline5', tmpDir);
    const range = fileTools.readFileRange('lines.txt', 2, 4, tmpDir);
    expect(range).toBe('line2\nline3\nline4');
  });

  it('throws on missing file', () => {
    expect(() => fileTools.readFile('nope.txt', tmpDir)).toThrow('Archivo no encontrado');
  });

  it('lists files with filtering', () => {
    fileTools.writeFile('a.ts', 'ts', tmpDir);
    fileTools.writeFile('b.js', 'js', tmpDir);
    fileTools.writeFile('c.json', 'json', tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true });
    fileTools.writeFile('sub/d.ts', 'ts', tmpDir);

    const all = fileTools.listFiles('.', tmpDir);
    expect(all.length).toBe(4);
  });

  it('searches in files', () => {
    fileTools.writeFile('alpha.txt', 'hello alpha world', tmpDir);
    fileTools.writeFile('beta.txt', 'hello beta world', tmpDir);

    const results = fileTools.searchInFiles('alpha', tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].file).toContain('alpha.txt');
  });

  it('searches with file pattern', () => {
    fileTools.writeFile('code.ts', 'function hello()', tmpDir);
    fileTools.writeFile('readme.md', 'hello there', tmpDir);

    const results = fileTools.searchInFiles('hello', tmpDir, '*.ts');
    expect(results.length).toBe(1);
    expect(results[0].file).toContain('code.ts');
  });

  it('deletes files', () => {
    fileTools.writeFile('delete-me.txt', 'x', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'delete-me.txt'))).toBe(true);
    fileTools.deleteFile('delete-me.txt', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'delete-me.txt'))).toBe(false);
  });

  it('creates parent directories', () => {
    fileTools.writeFile('deep/nested/file.txt', 'deep content', tmpDir);
    expect(fileTools.readFile('deep/nested/file.txt', tmpDir)).toBe('deep content');
  });
});
