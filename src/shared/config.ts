// src/shared/config.ts
// Configuracion persistente (jarvis.json en el vault)

import * as fs from 'fs';
import * as path from 'path';
import type { ChatMessage } from './types';
import { ensureDir } from './utils';

export interface JarvisConfig {
  currentModel: string;
  chatHistory: ChatMessage[];
  totalTokensUsed: number;
  totalRequests: number;
  turnCount: number;
  vaultDir: string;
  projectDirs: string[];
  version: string;
  lastSession: string;
}

export class ConfigStore {
  private filePath: string;
  private data: JarvisConfig;

  constructor(dir: string) {
    ensureDir(dir);
    this.filePath = path.join(dir, 'jarvis.json');
    this.data = this.load();
  }

  private defaults(): JarvisConfig {
    return {
      currentModel: '',
      chatHistory: [],
      totalTokensUsed: 0,
      totalRequests: 0,
      turnCount: 0,
      vaultDir: './vault',
      projectDirs: [],
      version: '5.0.0',
      lastSession: new Date().toISOString(),
    };
  }

  private load(): JarvisConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return { ...this.defaults(), ...JSON.parse(raw) };
      }
    } catch {}
    return this.defaults();
  }

  save(): void {
    try {
      this.data.lastSession = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {}
  }

  // Model
  get currentModel(): string { return this.data.currentModel; }
  setCurrentModel(model: string): void {
    this.data.currentModel = model;
    this.save();
  }

  // Chat history
  get chatHistory(): ChatMessage[] { return this.data.chatHistory; }
  setChatHistory(history: ChatMessage[]): void {
    this.data.chatHistory = history.slice(-100);
    this.save();
  }

  // Token tracking
  get totalTokens(): number { return this.data.totalTokensUsed; }
  addTokens(prompt: number, completion: number): void {
    this.data.totalTokensUsed += prompt + completion;
    this.data.totalRequests++;
    this.data.turnCount++;
    this.save();
  }

  // Turn count for auto-summary
  get turnCount(): number { return this.data.turnCount; }
  resetTurnCount(): void {
    this.data.turnCount = 0;
    this.save();
  }

  // Project dirs
  addProjectDir(dir: string): void {
    if (!this.data.projectDirs.includes(dir)) {
      this.data.projectDirs.push(dir);
      this.save();
    }
  }

  get stats(): { tokens: number; requests: number; turns: number; history: number } {
    return {
      tokens: this.data.totalTokensUsed,
      requests: this.data.totalRequests,
      turns: this.data.turnCount,
      history: this.data.chatHistory.length,
    };
  }
}
