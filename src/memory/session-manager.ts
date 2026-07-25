import * as fs from 'fs';
import * as path from 'path';
import { SessionMemory } from './session';
import { ensureDir } from '../shared/utils';
import { log } from '../shared/logger';

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model: string;
  summary: string;
  tags: string[];
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class SessionManager {
  private sessionsDir: string;
  private sessions: Map<string, SessionMeta> = new Map();
  private activeSessionId: string;
  private activeSession: SessionMemory;
  private indexFile: string;

  constructor(vaultDir: string) {
    this.sessionsDir = path.join(vaultDir, 'sessions');
    this.indexFile = path.join(vaultDir, 'session-index.json');
    ensureDir(this.sessionsDir);
    this.loadIndex();
    this.activeSessionId = this.sessions.size > 0
      ? Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      : this.createSession('default');
    this.activeSession = this.loadSession(this.activeSessionId);
    log.info('SessionManager initialized', { sessions: this.sessions.size, active: this.activeSessionId });
  }

  private sessionPath(id: string): string {
    return path.join(this.sessionsDir, `${id}.json`);
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
        this.sessions = new Map(Object.entries(data));
      }
    } catch { this.sessions = new Map(); }
  }

  private saveIndex(): void {
    try {
      const data: Record<string, SessionMeta> = {};
      for (const [id, meta] of this.sessions) data[id] = meta;
      fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e: unknown) {
      log.warn('Failed to save session index', { error: String(e) });
    }
  }

  private loadSession(id: string): SessionMemory {
    const sp = this.sessionPath(id);
    return new SessionMemory({ persistFile: sp, maxEvents: 500 });
  }

  createSession(name?: string, model?: string): string {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const meta: SessionMeta = {
      id,
      name: name || `Session ${this.sessions.size + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      model: model || '',
      summary: '',
      tags: [],
      conversation: [],
    };
    this.sessions.set(id, meta);
    this.saveIndex();
    log.info('Session created', { id, name: meta.name });
    return id;
  }

  switchSession(id: string): SessionMemory | null {
    if (!this.sessions.has(id)) return null;
    this.activeSessionId = id;
    this.activeSession = this.loadSession(id);
    this.getMeta(id).updatedAt = Date.now();
    this.saveIndex();
    log.info('Session switched', { id, name: this.getMeta(id).name });
    return this.activeSession;
  }

  getActive(): SessionMemory {
    return this.activeSession;
  }

  getActiveId(): string {
    return this.activeSessionId;
  }

  renameSession(id: string, name: string): boolean {
    const meta = this.sessions.get(id);
    if (!meta) return false;
    meta.name = name;
    meta.updatedAt = Date.now();
    this.saveIndex();
    return true;
  }

  deleteSession(id: string): boolean {
    if (this.sessions.size <= 1) return false;
    if (!this.sessions.has(id)) return false;
    this.sessions.delete(id);
    try {
      const sp = this.sessionPath(id);
      if (fs.existsSync(sp)) fs.unlinkSync(sp);
    } catch { /* cleanup best-effort */ }
    this.saveIndex();
    if (this.activeSessionId === id) {
      const first = Array.from(this.sessions.keys())[0];
      this.switchSession(first);
    }
    return true;
  }

  listSessions(): SessionMeta[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getMeta(id: string): SessionMeta {
    return this.sessions.get(id)!;
  }

  updateMeta(id: string, updates: Partial<SessionMeta>): void {
    const meta = this.sessions.get(id);
    if (!meta) return;
    Object.assign(meta, updates);
    meta.updatedAt = Date.now();
    this.saveIndex();
  }

  recordMessage(id: string, role: string, content: string): void {
    const meta = this.sessions.get(id);
    if (!meta) return;
    meta.messageCount++;
    meta.updatedAt = Date.now();
    if (role === 'user') {
      meta.summary = content.slice(0, 100);
    }
    this.saveIndex();
  }

  saveConversation(id: string, conversation: Array<{ role: 'user' | 'assistant'; content: string }>): void {
    const meta = this.sessions.get(id);
    if (!meta) return;
    meta.conversation = conversation.slice(-20);
    meta.messageCount = conversation.length;
    meta.updatedAt = Date.now();
    this.saveIndex();
  }

  getConversation(id: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.sessions.get(id)?.conversation || [];
  }

  getSessionModel(id: string): string {
    return this.sessions.get(id)?.model || '';
  }

  totalSessions(): number {
    return this.sessions.size;
  }

  toPrompt(maxSessions = 5): string {
    const recent = this.listSessions().slice(0, maxSessions);
    if (recent.length === 0) return '';
    return recent.map(s =>
      `${s.id === this.activeSessionId ? '*' : ' '} ${s.name} (${s.messageCount} msgs, ${new Date(s.updatedAt).toLocaleString()})`
    ).join('\n');
  }
}
