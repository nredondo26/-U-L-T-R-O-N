// src/memory/session.ts
// Memoria de sesion persistente

import * as fs from 'fs';
import type { SessionEvent, SessionMemoryData } from '../shared/types';
import { loadJSON, saveJSON, ensureDir } from '../shared/utils';

export class SessionMemory {
  private data: SessionMemoryData;
  private readonly maxEvents: number;
  private readonly persistFile?: string;
  private counter = 0;

  constructor(opts: { maxEvents?: number; persistFile?: string } = {}) {
    this.maxEvents = opts.maxEvents || 500;
    this.persistFile = opts.persistFile;
    this.data = this.loadPersisted() || this.newSession();
  }

  private newSession(): SessionMemoryData {
    return {
      sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      createdAt: Date.now(),
      events: [],
    };
  }

  private loadPersisted(): SessionMemoryData | null {
    if (!this.persistFile) return null;
    try {
      const data = loadJSON<SessionMemoryData | null>(this.persistFile, null);
      if (data?.sessionId && Array.isArray(data.events)) return data;
    } catch { /* session cleanup non-critical */ }
    return null;
  }

  private persist(): void {
    if (!this.persistFile) return;
    saveJSON(this.persistFile, this.data);
  }

  private newId(): string {
    this.counter += 1;
    return this.data.sessionId + '_ev' + this.counter;
  }

  record(type: string, summary: string, detail?: string, opts: { related?: string[]; tags?: string[] } = {}): SessionEvent {
    const ev: SessionEvent = {
      id: this.newId(),
      type,
      timestamp: Date.now(),
      summary,
      detail,
      related: opts.related,
      tags: opts.tags,
    };
    this.data.events.push(ev);
    if (this.data.events.length > this.maxEvents) {
      this.data.events = this.data.events.slice(-this.maxEvents);
    }
    this.persist();
    return ev;
  }

  recordTask(summary: string, detail?: string, related?: string[]): void {
    this.record('task', summary, detail, { related, tags: ['task'] });
  }

  recordError(message: string, detail?: string): void {
    this.record('error', message, detail, { tags: ['error'] });
  }

  recordDecision(decision: string, taskId?: string): void {
    this.record('decision', decision, taskId ? 'Tarea: ' + taskId : undefined, { tags: ['permission'] });
  }

  recordFileCreated(filePath: string, related?: string): void {
    this.record('file', 'Creado: ' + filePath, undefined, { related: related ? [related] : undefined, tags: ['create'] });
  }

  getRecent(n = 20): SessionEvent[] {
    return this.data.events.slice(-n);
  }

  getByType(type: string): SessionEvent[] {
    return this.data.events.filter(e => e.type === type);
  }

  toPromptSummary(maxChars = 800): string {
    const recent = this.data.events.slice(-25);
    if (recent.length === 0) return '(memoria de sesion vacia)';
    const lines = recent.map(ev => {
      const ts = new Date(ev.timestamp).toISOString().slice(11, 19);
      let line = `[${ts}] ${ev.type}: ${ev.summary}`;
      if (ev.detail) line += ' - ' + ev.detail.slice(0, 80);
      return line;
    });
    const out = lines.join('\n');
    return out.length > maxChars ? out.slice(-maxChars) : out;
  }

  toJSON(): SessionMemoryData {
    return JSON.parse(JSON.stringify(this.data));
  }

  clear(): void {
    this.data = this.newSession();
    this.persist();
  }
}
