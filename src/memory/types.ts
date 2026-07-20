// src/memory/types.ts
import type { VaultNote, VaultGraph, SessionMemoryData } from '../shared/types';

export interface VaultStore {
  listNotes(): VaultNote[];
  readNote(name: string): VaultNote | null;
  writeNote(name: string, content: string): VaultNote;
  deleteNote(name: string): boolean;
  searchNotes(query: string): VaultNote[];
  getGraph(): VaultGraph;
  buildContext(): string;
  autoSave(type: string, data: unknown): string;
}

export interface SessionStore {
  record(type: string, summary: string, detail?: string, opts?: { related?: string[]; tags?: string[] }): void;
  getRecent(n?: number): unknown[];
  getByType(type: string): unknown[];
  toPromptSummary(maxChars?: number): string;
  toJSON(): SessionMemoryData;
  clear(): void;
}
