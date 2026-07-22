// src/memory/vault.ts
// Sistema de vault Obsidian: notas markdown con [[links]] y #tags

import * as fs from 'fs';
import * as path from 'path';
import type { VaultNote, VaultGraph } from '../shared/types';
import { ensureDir, sanitizeFilename } from '../shared/utils';
import { log } from '../shared/logger';

const MAX_NOTES = 1000;
const MAX_CONTEXT_NOTES = 50;
const AUTO_CLEANUP_DAYS = 30;

export class ObsidianVault {
  private vaultDir: string;

  constructor(vaultDir: string) {
    this.vaultDir = vaultDir;
    ensureDir(vaultDir);
    this.cleanup();
  }

  private cleanup(): void {
    try {
      let notes = this.listNotes();
      if (notes.length <= MAX_NOTES) return;
      // Remove old auto-generated notes first
      const now = Date.now();
      for (const n of notes) {
        if (n.name.startsWith('accion_') || n.name.startsWith('contexto_') || n.name.startsWith('nota_')) {
          const age = now - fs.statSync(path.join(this.vaultDir, n.name + '.md')).mtimeMs;
          if (age > AUTO_CLEANUP_DAYS * 86400000) this.deleteNote(n.name);
        }
      }
      // Hard cap: remove oldest notes until under limit
      notes = this.listNotes();
      if (notes.length > MAX_NOTES) {
        const sorted = [...notes].sort((a, b) => {
          const aMtime = fs.statSync(path.join(this.vaultDir, a.name + '.md')).mtimeMs;
          const bMtime = fs.statSync(path.join(this.vaultDir, b.name + '.md')).mtimeMs;
          return aMtime - bMtime;
        });
        for (const n of sorted.slice(0, notes.length - MAX_NOTES)) this.deleteNote(n.name);
      }
    } catch (e) {
      log.warn('vault cleanup error', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  listNotes(): VaultNote[] {
    const notes: VaultNote[] = [];
    const scan = (dir: string, rel: string): void => {
      try {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const relPath = rel ? rel + '/' + item.name : item.name;
          if (item.isDirectory()) {
            scan(path.join(dir, item.name), relPath);
          } else if (item.name.endsWith('.md')) {
            const fullPath = path.join(dir, item.name);
            const content = fs.readFileSync(fullPath, 'utf8');
            const links = (content.match(/\[\[([^\]]+)\]\]/g) || []).map(l => l.slice(2, -2));
            const tags = (content.match(/#[a-zA-Z0-9_-]+/g) || []).map(t => t.slice(1));
            const firstLine = content.split('\n').find(
              l => l.trim() && !l.startsWith('#') && !l.startsWith('---')
            ) || item.name.replace('.md', '');
            notes.push({
              name: item.name.replace('.md', ''),
              path: relPath,
              size: content.length,
              links,
              tags,
              excerpt: firstLine.trim().slice(0, 150),
              content,
            });
          }
        }
      } catch {}
    };
    scan(this.vaultDir, '');
    return notes;
  }

  readNote(name: string): VaultNote | null {
    const safeName = sanitizeFilename(name);
    const filePath = path.join(this.vaultDir, safeName + '.md');
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const links = (content.match(/\[\[([^\]]+)\]\]/g) || []).map(l => l.slice(2, -2));
    const tags = (content.match(/#[a-zA-Z0-9_-]+/g) || []).map(t => t.slice(1));
    return {
      name: safeName,
      path: safeName + '.md',
      size: content.length,
      links,
      tags,
      excerpt: content.split('\n').find(l => l.trim())?.slice(0, 150) || '',
      content,
    };
  }

  writeNote(name: string, content: string): VaultNote {
    const safeName = sanitizeFilename(name);
    const filePath = path.join(this.vaultDir, safeName + '.md');
    fs.writeFileSync(filePath, content, 'utf8');
    return { name: safeName, path: safeName + '.md', size: content.length, links: [], tags: [], excerpt: content.slice(0, 150) };
  }

  deleteNote(name: string): boolean {
    const safeName = sanitizeFilename(name);
    const filePath = path.join(this.vaultDir, safeName + '.md');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  searchNotes(query: string): VaultNote[] {
    const q = query.toLowerCase();
    return this.listNotes().filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.excerpt.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q)),
    );
  }

  getGraph(): VaultGraph {
    const notes = this.listNotes();
    const nodes = notes.map(n => ({ id: n.name, tags: n.tags, excerpt: n.excerpt, size: n.size }));
    const noteNames = new Set(notes.map(n => n.name));
    const edges: VaultGraph['edges'] = [];
    for (const n of notes) {
      for (const target of n.links) {
        const cleanTarget = target.split('|')[0].trim();
        edges.push({ source: n.name, target: cleanTarget });
      }
    }
    return { nodes, edges };
  }

  buildContext(): string {
    const allNotes = this.listNotes();
    if (allNotes.length === 0) return '(vault vacio)';
    const notes = allNotes.sort(() => Math.random() - 0.5).slice(0, MAX_CONTEXT_NOTES);
    const header = notes.length < allNotes.length ? `[mostrando ${notes.length} de ${allNotes.length} notas]\n` : '';
    return header + notes
      .map(n => `- ${n.name}: ${n.excerpt} [links: ${n.links.join(', ') || 'ninguno'}] [tags: ${n.tags.join(', ') || 'ninguno'}]`)
      .join('\n');
  }

  autoSave(type: string, data: unknown): string {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_');
    let name: string;
    let content: string;

    switch (type) {
      case 'action': {
        const d = data as { summary: string; detail: string; result?: string };
        name = 'accion_' + ts;
        content = `---\ntipo: accion\nfecha: ${new Date().toISOString()}\n---\n\n# ${d.summary}\n\n${d.detail}${d.result ? '\n\n**Resultado:** ' + d.result : ''}`;
        break;
      }
      case 'learning': {
        const d = data as { topic: string; content: string; tags?: string[] };
        name = 'aprendizaje_' + d.topic.replace(/[^\w]+/g, '_').slice(0, 40);
        content = `---\ntipo: aprendizaje\nfecha: ${new Date().toISOString()}\ntags: [${(d.tags || []).join(', ')}]\n---\n\n# ${d.topic}\n\n${d.content}`;
        break;
      }
      case 'context': {
        name = 'contexto_' + ts;
        content = `---\ntipo: contexto\nfecha: ${new Date().toISOString()}\n---\n\n# Contexto\n\n${data}`;
        break;
      }
      case 'system': {
        name = 'capacidades_jarvis';
        content = `---\ntipo: sistema\n---\n\n# Capacidades de J.A.R.V.I.S.\n\n${data}`;
        break;
      }
      default: {
        name = 'nota_' + ts;
        content = String(data);
      }
    }

    this.writeNote(name, content);
    return name;
  }
}
