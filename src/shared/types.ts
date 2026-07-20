// src/shared/types.ts
// Tipos compartidos para todo J.A.R.V.I.S. v5

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export interface AgentContext {
  projectDir: string;
  vaultDir: string;
  workingDir: string;
  chatHistory: ChatMessage[];
  sessionId: string;
  taskId: string | null;
}

export interface AgentStep {
  agent: string;
  thought: string;
  action: string;
  result: string;
  error?: string;
  timestamp: number;
}

export interface VaultNote {
  name: string;
  path: string;
  size: number;
  links: string[];
  tags: string[];
  excerpt: string;
  content?: string;
}

export interface VaultGraph {
  nodes: Array<{ id: string; tags: string[]; excerpt: string; size: number }>;
  edges: Array<{ source: string; target: string }>;
}

export interface SessionMemoryData {
  sessionId: string;
  createdAt: number;
  events: SessionEvent[];
}

export interface SessionEvent {
  id: string;
  type: string;
  timestamp: number;
  summary: string;
  detail?: string;
  related?: string[];
  tags?: string[];
}
