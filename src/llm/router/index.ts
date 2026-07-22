// Smart Router — Free-first, coding-aware, auto-fallback

import OpenAI from 'openai';
import type { ChatMessage, ToolDefinition, ToolCall } from '../../shared/types';
import type {
  LLMCompletionRequest, LLMCompletionResponse,
  LLMProvider, ModelEntry,
  StreamChunkHandler, ModelSwitchEvent,
} from '../types';
import { getProviders } from '../providers';
import { getModelHealth } from '../health';
import { CircuitBreaker } from './circuit-breaker';
import { CostTracker } from './cost-tracker';
import { scoreModels } from './strategies/auto';
import type { ModelCandidate, RouterConfig, ScoredModel } from './types';
import { DEFAULT_CONFIG } from './types';

export { CircuitBreaker, CostTracker };
export type { RouterConfig };

const clientCache = new Map<string, OpenAI>();

function getClient(baseURL: string, apiKey: string): OpenAI {
  const key = baseURL + apiKey;
  if (!clientCache.has(key)) {
    clientCache.set(key, new OpenAI({ baseURL, apiKey, timeout: 30000, maxRetries: 1 }));
  }
  return clientCache.get(key)!;
}

function getModelCandidates(): ModelCandidate[] {
  const candidates: ModelCandidate[] = [];
  for (const p of getProviders()) {
    for (const m of p.models) {
      const health = getModelHealth(m.id);
      candidates.push({
        provider: p.name,
        model: m.id,
        free: m.free,
        baseURL: p.baseURL,
        apiKey: p.apiKey,
        codingScore: m.codingScore,
        latencyMs: health.latencyMs ?? undefined,
      });
    }
  }
  return candidates;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const clean: ChatMessage[] = [];
  let hasPendingToolCalls = false;
  for (const msg of messages) {
    if (msg.role === 'tool') {
      if (hasPendingToolCalls) clean.push(msg);
      hasPendingToolCalls = false;
      continue;
    }
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      hasPendingToolCalls = true;
      clean.push(msg);
      continue;
    }
    if (msg.role === 'assistant' && msg.tool_calls) {
      clean.push({ role: 'assistant', content: msg.content });
      continue;
    }
    clean.push(msg);
  }
  if (hasPendingToolCalls) {
    clean.push({ role: 'user', content: '(Tool calls from previous model were interrupted. Continue with the next model.)' });
  }
  return clean;
}

export class SmartRouter {
  private cb = new CircuitBreaker();
  private ct = new CostTracker();
  private config: RouterConfig;

  constructor(config?: Partial<RouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getCircuitBreaker(): CircuitBreaker { return this.cb; }
  getCostTracker(): CostTracker { return this.ct; }
  getConfig(): RouterConfig { return this.config; }

  async complete(
    req: LLMCompletionRequest,
    onChunk?: StreamChunkHandler,
    onSwitch?: (event: ModelSwitchEvent) => void,
  ): Promise<LLMCompletionResponse> {
    if (this.config.strategy === 'fusion') {
      return this.completeFusion(req, onChunk, onSwitch);
    }

    const cleanMessages = sanitizeMessages(req.messages);
    const cleanReq = { ...req, messages: cleanMessages };

    let candidates = getModelCandidates();
    if (candidates.length === 0) throw new Error('No hay modelos LLM configurados.');

    // If a specific model was requested, prefer it but keep fallbacks
    if (req.model && req.model !== 'auto') {
      const preferred = candidates.find(c => c.model === req.model);
      if (preferred) {
        candidates = [preferred, ...candidates.filter(c => c.model !== req.model)];
      }
    }

    const tried = new Set<string>();
    const attemptedModels: ModelCandidate[] = [];
    let attempts = 0;

    while (attempts < this.config.maxAttempts) {
      attempts++;

      // Filter available candidates
      const available = candidates.filter(c => {
        if (tried.has(c.model)) return false;
        if (this.cb.isProviderBlocked(c.provider)) return false;
        if (this.cb.isConnectionCooling(c.baseURL)) return false;
        if (this.cb.isModelLocked(c.model)) return false;
        return true;
      });

      if (available.length === 0) {
        throw new Error(`Todos los modelos fallaron (${tried.size} intentos). Verifica tus API keys.`);
      }

      // Build circuit breaker + cost state for scoring
      const cbState = { models: {} as Record<string, { locked: boolean }> };
      for (const c of candidates) {
        cbState.models[c.model] = { locked: this.cb.isModelLocked(c.model) };
      }
      const ctState = {
        quotas: Object.fromEntries(
          getProviders().map(p => [p.name, this.ct.getEstimatedQuota(p.name)]),
        ),
      };

      // In free-first mode, boost free model scores
      const scored = scoreModels(available, cbState, ctState);

      // Apply free-first preference: ensure free coding models are at top
      let best: ModelCandidate;
      if (this.config.preferFree) {
        const freeCoding = scored.filter(s => s.free && (s.codingScore || 0) >= this.config.minCodingScore);
        if (freeCoding.length > 0) {
          best = freeCoding[0];
        } else {
          const freeAny = scored.filter(s => s.free);
          best = freeAny.length > 0 ? freeAny[0] : scored[0];
        }
      } else {
        best = scored[0];
      }

      const chosen = best.model;
      tried.add(chosen);
      const provider = getProviders().find(p => p.models.some(m => m.id === chosen));
      if (!provider) continue;

      if (chosen !== req.model && req.model !== 'auto') {
        onSwitch?.({ from: req.model, to: chosen, reason: `SmartRouter: free-first auto-selection` });
      }

      const client = getClient(provider.baseURL, provider.apiKey);

      try {
        const result = cleanReq.stream !== false && onChunk
          ? await this.streamChat(client, chosen, cleanReq, onChunk)
          : await this.syncChat(client, chosen, cleanReq);

        this.cb.recordProviderSuccess(provider.name);
        this.cb.recordConnectionSuccess(provider.baseURL);
        this.cb.recordModelSuccess(chosen);

        if (result.usage) {
          this.ct.recordUsage(provider.name, result.usage.prompt_tokens, result.usage.completion_tokens);
        }

        return result;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);

        const isAuth = /40[123]|invalid.*key|unauthorized|User not found|insufficient_balance/i.test(errMsg);
        const isRateLimit = /429|rate.?limit|too many requests|Request too large|content_length/i.test(errMsg);
        const isModelError = /model.*not found|model.*unavailable|model_not_found/i.test(errMsg);
        const is4xx = /4\d\d/.test(errMsg);

        if (isAuth) {
          this.cb.recordProviderError(provider.name, true);
        } else if (isRateLimit || is4xx) {
          // Rate limit or HTTP 4xx -> just lock this model, not the whole provider
          this.cb.recordModelError(chosen);
        } else if (isModelError) {
          this.cb.recordModelError(chosen);
        } else {
          // Timeout, network error, etc -> light connection penalty
          this.cb.recordConnectionError(provider.baseURL);
        }

        const nextAttempt = scored.find(s => !tried.has(s.model));
        if (nextAttempt) {
          const reason = errMsg.length > 60 ? errMsg.slice(0, 57) + '...' : errMsg;
          onSwitch?.({ from: chosen, to: nextAttempt.model, reason: `${chosen.split('/').pop()}: ${reason}` });
        }
      }
    }

    throw new Error(`Límite de ${this.config.maxAttempts} intentos alcanzado sin respuesta exitosa.`);
  }

  private async streamChat(
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
      stream_options: { include_usage: true },
    });

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const toolCalls: Map<number, { id: string; function: { name: string; arguments: string } }> = new Map();

    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage;
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
      .map(tc => ({ id: tc.id, type: 'function' as const, function: tc.function }));

    return {
      content: fullContent || null,
      tool_calls: tcArray.length > 0 ? tcArray : null,
      finish_reason: tcArray.length > 0 ? 'tool_calls' : 'stop',
      model,
      usage: usage ? { prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0 } : undefined,
    };
  }

  private async syncChat(
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
    if (!choice) throw new Error('Respuesta vacía del modelo');

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
      usage: response.usage ? { prompt_tokens: response.usage.prompt_tokens, completion_tokens: response.usage.completion_tokens } : undefined,
    };
  }

  private async completeFusion(
    req: LLMCompletionRequest,
    onChunk?: StreamChunkHandler,
    onSwitch?: (event: ModelSwitchEvent) => void,
  ): Promise<LLMCompletionResponse> {
    const cleanMessages = sanitizeMessages(req.messages);
    const cleanReq = { ...req, messages: cleanMessages };

    const candidates = getModelCandidates();
    if (candidates.length === 0) throw new Error('No hay modelos LLM configurados.');

    const cbState = { models: {} as Record<string, { locked: boolean }> };
    for (const c of candidates) cbState.models[c.model] = { locked: this.cb.isModelLocked(c.model) };

    const ctState = {
      quotas: Object.fromEntries(
        getProviders().map(p => [p.name, this.ct.getEstimatedQuota(p.name)]),
      ),
    };

    const scored = scoreModels(candidates, cbState, ctState);

    // Pick top model per provider, up to fusionCount
    const seenProviders = new Set<string>();
    const panel: ScoredModel[] = [];
    for (const m of scored) {
      if (seenProviders.has(m.provider)) continue;
      if (this.cb.isProviderBlocked(m.provider)) continue;
      if (this.cb.isModelLocked(m.model)) continue;
      seenProviders.add(m.provider);
      panel.push(m);
      if (panel.length >= this.config.fusionCount) break;
    }

    if (panel.length === 0) throw new Error('No hay modelos disponibles para fusion.');

    const names = panel.map(m => `${m.model} (score:${m.score})`).join(', ');
    console.log(`[Fusion] Consultando panel: ${names}`);

    const results = await Promise.allSettled(
      panel.map(async (entry) => {
        const provider = getProviders().find(p => p.name === entry.provider);
        if (!provider) throw new Error(`Provider ${entry.provider} not found`);
        const client = getClient(provider.baseURL, provider.apiKey);
        try {
          const result = await this.syncChat(client, entry.model, cleanReq);
          return { result, model: entry.model, provider: entry.provider, entry };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.cb.recordConnectionError(provider.baseURL);
          throw new Error(`${entry.model}: ${msg}`);
        }
      }),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ result: LLMCompletionResponse; model: string; provider: string; entry: ScoredModel }>[];
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (rejected.length > 0) {
      console.log(`[Fusion] ${rejected.length}/${panel.length} modelos fallaron`);
    }

    if (fulfilled.length === 0) {
      // All failed — fall back to regular auto routing
      console.log('[Fusion] Todos fallaron, cayendo a auto...');
      this.config.strategy = 'auto';
      return this.complete(req, onChunk, onSwitch);
    }

    // Sort fulfilled by score (highest first)
    fulfilled.sort((a, b) => b.value.entry.score - a.value.entry.score);

    // Prefer result with tool_calls from highest-scoring model
    const withTools = fulfilled.find(f => f.value.result.tool_calls && f.value.result.tool_calls.length > 0);
    if (withTools) {
      const { result, model, provider } = withTools.value;
      console.log(`[Fusion] Elegido ${model} (tool_calls)`);
      onSwitch?.({ from: 'fusion', to: model, reason: `Fusion: ${model} genero tool_calls` });

      if (result.usage) this.ct.recordUsage(provider, result.usage.prompt_tokens, result.usage.completion_tokens);
      this.cb.recordProviderSuccess(provider);
      this.cb.recordModelSuccess(model);

      if (onChunk) {
        if (result.content) onChunk({ content: result.content, done: false });
        onChunk({ done: true });
      }
      return result;
    }

    // All returned content — pick highest-scoring
    const best = fulfilled[0].value;
    const { result, model, provider, entry } = best;
    console.log(`[Fusion] Elegido ${model} (content, score:${entry.score})`);
    onSwitch?.({ from: 'fusion', to: model, reason: `Fusion: ${model} score ${entry.score}` });

    if (result.usage) this.ct.recordUsage(provider, result.usage.prompt_tokens, result.usage.completion_tokens);
    this.cb.recordProviderSuccess(provider);
    this.cb.recordModelSuccess(model);

    if (onChunk) {
      if (result.content) onChunk({ content: result.content, done: false });
      onChunk({ done: true });
    }
    return result;
  }

  getState(): object {
    return {
      circuitBreaker: this.cb.getState(),
      costs: this.ct.getSummary(),
      config: this.config,
    };
  }
}
