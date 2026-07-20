// src/llm/types.ts
import type { ChatMessage, ToolDefinition, ToolCall } from '../shared/types';

export interface LLMProvider {
  name: string;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  models: ModelEntry[];
}

export interface ModelEntry {
  id: string;
  free: boolean;
}

export interface LLMCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMCompletionResponse {
  content: string | null;
  tool_calls: ToolCall[] | null;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'error';
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export type StreamChunkHandler = (chunk: {
  content?: string;
  tool_calls?: Partial<ToolCall>[];
  done: boolean;
}) => void;

export interface ModelSwitchEvent {
  from: string;
  to: string;
  reason: string;
}
