// src/agents/types.ts
import type { ChatMessage, ToolDefinition, AgentContext } from '../shared/types';

export interface AgentConfig {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResult {
  content: string;
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  model: string;
  tokens?: { prompt: number; completion: number };
}

export interface OrchestratorConfig {
  projectDir: string;
  vaultDir: string;
  maxSteps: number;
  verbose: boolean;
}

export interface AgentEvent {
  type: 'thought' | 'action' | 'result' | 'error' | 'delegate' | 'done';
  agent: string;
  displayName?: string;
  message: string;
  data?: unknown;
}
