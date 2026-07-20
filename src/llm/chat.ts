// src/llm/chat.ts
// Cliente unificado con fallback automatico, free first

import OpenAI from 'openai';
import type { ChatMessage, ToolDefinition, ToolCall } from '../shared/types';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  StreamChunkHandler,
  ModelSwitchEvent,
} from './types';
import { getProvider, getFallbackChain, getProviders } from './providers';

let _clientCache: Map<string, OpenAI> = new Map();

function getClient(baseURL: string, apiKey: string): OpenAI {
  const key = baseURL + apiKey;
  if (!_clientCache.has(key)) {
    _clientCache.set(key, new OpenAI({ baseURL, apiKey }));
  }
  return _clientCache.get(key)!;
}

export async function chatCompletion(
  req: LLMCompletionRequest,
  onChunk?: StreamChunkHandler,
  onSwitch?: (event: ModelSwitchEvent) => void,
): Promise<LLMCompletionResponse> {
  // SAFETY: strip orphaned tool messages and tool_calls
  const cleanMessages = sanitizeMessages(req.messages);
  const cleanReq = { ...req, messages: cleanMessages };

  let currentModel = req.model;
  const tried = new Set<string>();
  const blockedProviders = new Set<string>();
  const fallbackChain = getFallbackChain(currentModel);
  const MAX_ATTEMPTS = 15;

  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    tried.add(currentModel);

    // Skip if provider is blocked
    const provider = getProvider(currentModel);
    if (!provider) {
      throw new Error('No hay proveedores LLM configurados.');
    }

    if (blockedProviders.has(provider.name)) {
      // Find next model from a different provider
      const next = fallbackChain.find(m => !tried.has(m.model) && !blockedProviders.has(m.provider));
      if (!next) throw new Error(`Proveedor ${provider.name} bloqueado y sin alternativas.`);
      currentModel = next.model;
      continue;
    }

    const client = getClient(provider.baseURL, provider.apiKey);
    const isStreaming = req.stream !== false;

    try {
      const result = isStreaming && onChunk
        ? await streamChat(client, currentModel, req, onChunk)
        : await syncChat(client, currentModel, req);
      return result;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);

      // Detect auth errors -> block entire provider
      if (/401|403|invalid.*key|unauthorized|User not found/i.test(errMsg)) {
        blockedProviders.add(provider.name);
      }

      // Skip same-provider models on auth failures
      const next = fallbackChain.find(m =>
        !tried.has(m.model) &&
        !blockedProviders.has(m.provider) &&
        (!/401|403/.test(errMsg) || m.provider !== provider.name),
      );

      if (next) {
        onSwitch?.({ from: currentModel, to: next.model, reason: `${currentModel.split('/').pop()}: ${errMsg.slice(0, 60)}` });
        currentModel = next.model;
        continue;
      }

      // Try any other provider
      const providers = getProviders().filter(p => !blockedProviders.has(p.name));
      const altProvider = providers.find(p => p.name !== provider.name);
      if (altProvider && !tried.has(altProvider.defaultModel)) {
        onSwitch?.({ from: currentModel, to: altProvider.defaultModel, reason: `${currentModel.split('/').pop()}: ${errMsg.slice(0, 60)}` });
        currentModel = altProvider.defaultModel;
        continue;
      }

      throw new Error(`Todos los modelos fallaron (${tried.size} intentos).\nVerifica tus API keys en .env:\n  DEEPSEEK_API_KEY\n  NVIDIA_API_KEY\n  OPENROUTER_API_KEY\n\nUltimo error: ${errMsg}`);
    }
  }

  throw new Error(`Limite de ${MAX_ATTEMPTS} intentos alcanzado.`);
}

async function streamChat(
  client: OpenAI,
  model: string,
  req: LLMCompletionRequest,
  onChunk: StreamChunkHandler,
): Promise<LLMCompletionResponse> {
  const stream = await client.chat.completions.create({
    model,
    messages: req.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: req.tools as OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
    tool_choice: req.tool_choice as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption | undefined,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.max_tokens ?? 8192,
    stream: true,
  });

  let fullContent = '';
  const toolCalls: Map<number, { id: string; function: { name: string; arguments: string } }> = new Map();

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) {
      fullContent += delta.content;
      onChunk({ content: delta.content, done: false });
    }
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCalls.has(idx)) {
          toolCalls.set(idx, { id: tc.id || '', function: { name: tc.function?.name || '', arguments: '' } });
        }
        const existing = toolCalls.get(idx)!;
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name = tc.function.name;
        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
      }
    }
    if (chunk.choices?.[0]?.finish_reason) {
      onChunk({ done: true });
    }
  }

  const tcArray: ToolCall[] = Array.from(toolCalls.values())
    .filter(tc => tc.function.name)
    .map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: tc.function,
    }));

  return {
    content: fullContent || null,
    tool_calls: tcArray.length > 0 ? tcArray : null,
    finish_reason: tcArray.length > 0 ? 'tool_calls' : 'stop',
    model,
  };
}

async function syncChat(
  client: OpenAI,
  model: string,
  req: LLMCompletionRequest,
): Promise<LLMCompletionResponse> {
  const response = await client.chat.completions.create({
    model,
    messages: req.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: req.tools as OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
    tool_choice: req.tool_choice as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption | undefined,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.max_tokens ?? 8192,
    stream: false,
  });

  const choice = response.choices?.[0];
  if (!choice) throw new Error('Respuesta vacia del modelo');

  const tcArray: ToolCall[] | null = choice.message.tool_calls
    ? choice.message.tool_calls.map((tc) => {
        const t = tc as unknown as { id: string; function: { name: string; arguments: string } };
        return { id: t.id, type: 'function' as const, function: { name: t.function.name, arguments: t.function.arguments } };
      })
    : null;

  return {
    content: choice.message.content || null,
    tool_calls: tcArray,
    finish_reason: (choice.finish_reason as LLMCompletionResponse['finish_reason']) || 'stop',
    model,
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
    } : undefined,
  };
}

export function clearClientCache(): void { _clientCache.clear(); }

// Safety: strip orphaned tool calls and tool messages before sending to API
function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const clean: ChatMessage[] = [];
  let hasPendingToolCalls = false;

  for (const msg of messages) {
    if (msg.role === 'tool') {
      // Only keep tool messages if preceded by assistant with tool_calls
      if (hasPendingToolCalls) {
        clean.push(msg);
        hasPendingToolCalls = false;
      }
      // else: orphaned tool message, skip it
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      hasPendingToolCalls = true;
      clean.push(msg);
      continue;
    }

    // Strip tool_calls from old assistant messages (they're orphaned)
    if (msg.role === 'assistant' && msg.tool_calls) {
      clean.push({ role: 'assistant', content: msg.content });
      continue;
    }

    clean.push(msg);
  }

  // If last message has tool_calls but no tool responses followed, strip them
  if (hasPendingToolCalls && clean.length > 0) {
    const last = clean[clean.length - 1];
    if (last.role === 'assistant' && last.tool_calls) {
      clean[clean.length - 1] = { role: 'assistant', content: last.content };
    }
  }

  return clean;
}
