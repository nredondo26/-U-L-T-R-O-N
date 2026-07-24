// src/llm/providers.ts
import type { LLMProvider, ModelEntry } from './types';
import { isModelHealthy, getHealthyModels } from './health';
import { runDiscovery } from './discovery';

function M(id: string, free = false, codingScore?: number, tools?: boolean): ModelEntry {
  return { id, free, codingScore, tools };
}

function buildBaseProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  if (process.env.DASHSCOPE_API_KEY) {
    providers.push({
      name: 'alibaba',
      baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
      defaultModel: 'qwen-plus',
      models: [
        M('qwen-plus', false, 80), M('qwen-turbo', false, 70), M('qwen-max', false, 82),
        M('qwen3.7-plus', false, 85), M('qwen3.7-turbo', false, 78), M('qwen3.7-max', false, 87),
        M('qwen-coder-plus', false, 92), M('qwen-coder-turbo', false, 85),
        M('deepseek-r1', false), M('deepseek-v3', false),
      ],
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek', baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat',
      models: [M('deepseek-chat', false, 90), M('deepseek-reasoner', false, 88)],
    });
  }

  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia', baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: process.env.NVIDIA_API_KEY,
      defaultModel: 'deepseek-ai/deepseek-v4-flash',
      models: [
        M('deepseek-ai/deepseek-v4-flash', true, 90), M('deepseek-ai/deepseek-v4-pro', true, 85),
        M('deepseek-ai/deepseek-coder-6.7b-instruct', true, 85),
        M('meta/llama-3.1-8b-instruct', true), M('meta/llama-3.1-70b-instruct', true, 72),
        M('meta/llama-3.2-1b-instruct', true, 30, false), M('meta/llama-3.2-3b-instruct', true, 40, false),
        M('meta/llama-3.3-70b-instruct', true, 75), M('meta/llama-4-maverick-17b-128e-instruct', true, 80),
        M('meta/codellama-70b', true, 78, false),
        M('nvidia/llama-3.1-nemotron-nano-8b-v1', true), M('nvidia/llama-3.3-nemotron-super-49b-v1', true),
        M('nvidia/llama-3.3-nemotron-super-49b-v1_5', true), M('nvidia/nemotron-mini-4b-instruct', true, undefined, false),
        M('nvidia/nemotron-3-nano-30b-a3b', true), M('nvidia/nemotron-3-super-120b-a12b', true),
        M('nvidia/nemotron-3-ultra-550b-a55b', true), M('nvidia/mistral-nemotron', true),
        M('mistralai/ministral-14b-instruct-2512', true), M('mistralai/mistral-large-3-675b-instruct-2512', true),
        M('mistralai/mistral-medium-3.5-128b', true), M('mistralai/mistral-small-4-119b-2603', true),
        M('mistralai/mixtral-8x7b-instruct-v0.1', true), M('mistralai/codestral-22b-instruct-v0.1', true, 82),
        M('google/gemma-2-2b-it', true, undefined, false), M('google/gemma-3n-e2b-it', true, undefined, false), M('google/gemma-3n-e4b-it', true, undefined, false),
        M('google/gemma-4-31b-it', true), M('nvidia/dracarys-llama-3.1-70b-instruct', true),
        M('nvidia/gpt-oss-20b', true), M('nvidia/gpt-oss-120b', true), M('nvidia/laguna-xs-2.1', true),
        M('moonshotai/kimi-k2.6', true), M('minimax/minimax-m2.7', true), M('zhipu/glm-5.2', true),
        M('thinkingmachines/inkling', true), M('bytedance/seed-oss-36b-instruct', true),
        M('qwen/qwen3-next-80b-a3b-instruct', true), M('qwen/qwen3.5-122b-a10b', true),
        M('stepfun/step-3.5-flash', true), M('stepfun/step-3.7-flash', true),
        M('sarvam/sarvam-m', true), M('upstage/solar-10.7b-instruct', true),
        M('nvidia/nvidia-nemotron-nano-9b-v2', true),
      ],
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: 'deepseek/deepseek-chat',
      models: [
        M('deepseek/deepseek-chat', false), M('deepseek/deepseek-r1', false),
        M('anthropic/claude-sonnet-4', false), M('openai/gpt-4o', false), M('google/gemini-2.5-pro', false),
      ],
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: process.env.GEMINI_API_KEY,
      defaultModel: 'gemini-2.5-flash',
      models: [
        M('gemini-2.5-flash', true), M('gemini-2.5-pro', true),
        M('gemini-2.0-flash', true), M('gemini-2.0-flash-lite', true),
      ],
    });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'groq', baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY,
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        M('llama-3.3-70b-versatile', true), M('llama-3.1-8b-instant', true),
        M('mixtral-8x7b-32768', true), M('gemma2-9b-it', true),
        M('deepseek-r1-distill-llama-70b', true),
      ],
    });
  }

  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      name: 'mistral', baseURL: 'https://api.mistral.ai/v1', apiKey: process.env.MISTRAL_API_KEY,
      defaultModel: 'mistral-small-latest',
      models: [
        M('mistral-small-latest', false), M('mistral-medium-latest', false),
        M('mistral-large-latest', false), M('codestral-latest', false),
      ],
    });
  }

  if (process.env.COHERE_API_KEY) {
    providers.push({
      name: 'cohere', baseURL: 'https://api.cohere.com/v1', apiKey: process.env.COHERE_API_KEY,
      defaultModel: 'command-r-plus',
      models: [
        M('command-r-plus', false), M('command-r', false),
        M('command-a-03-2025', false),
      ],
    });
  }

  // Local providers
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST) {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || `http://${process.env.OLLAMA_HOST || 'localhost'}:11434/v1`;
    providers.push({
      name: 'ollama', baseURL: ollamaUrl, apiKey: 'ollama',
      defaultModel: 'llama3.1',
      models: [
        M('llama3.1', true, 70), M('llama3.2', true, 60),
        M('qwen3:14b', true, 75), M('qwen3-coder:14b', true, 85),
        M('deepseek-r1:14b', true, 80), M('codellama:13b', true, 78),
        M('mistral:7b', true, 65), M('gemma3:12b', true, 70),
      ],
    });
  }

  if (process.env.LM_STUDIO_BASE_URL) {
    providers.push({
      name: 'lmstudio', baseURL: process.env.LM_STUDIO_BASE_URL + '/v1', apiKey: 'lm-studio',
      defaultModel: 'local-model',
      models: [M('local-model', true, 70)],
    });
  }

  return providers;
}

let baseProviders = buildBaseProviders();
let providers: LLMProvider[] = [...baseProviders];
let discoveryStarted = false;

export function getProviders(): LLMProvider[] {
  return providers;
}

export function getBaseProviders(): LLMProvider[] {
  return baseProviders;
}

export async function initDiscovery(): Promise<void> {
  if (discoveryStarted) return;
  discoveryStarted = true;

  try {
    const updated = await runDiscovery(baseProviders);
    providers = updated;
  } catch {
    // Discovery failed — keep base providers
  }
}

export function resetProviders(): void {
  baseProviders = buildBaseProviders();
  providers = [...baseProviders];
  discoveryStarted = false;
}

export function getProvider(modelName?: string): LLMProvider | null {
  if (providers.length === 0) return null;

  if (modelName) {
    return providers.find(p => p.models.some(m => m.id === modelName)) || providers[0];
  }

  return providers.find(p => p.name === 'alibaba')
    || providers.find(p => p.name === 'deepseek')
    || providers.find(p => p.name === 'nvidia')
    || providers[0];
}

export function getAllModels(): Array<{ provider: string; model: string; free: boolean }> {
  return providers.flatMap(p => p.models.map(m => ({ provider: p.name, model: m.id, free: m.free })));
}

export function getHealthyModelList(): Array<{ provider: string; model: string; free: boolean }> {
  const healthy = new Set(getHealthyModels());
  const all = getAllModels();
  if (healthy.size === 0) return all;
  return all.filter(m => healthy.has(m.model));
}

export function getModelsForHealthCheck(): Array<{ id: string; baseURL: string; apiKey: string }> {
  const result: Array<{ id: string; baseURL: string; apiKey: string }> = [];
  const seen = new Set<string>();
  for (const p of providers) {
    for (const m of p.models) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push({ id: m.id, baseURL: p.baseURL, apiKey: p.apiKey });
      }
    }
  }
  return result;
}

export function getFallbackChain(modelName: string): Array<{ provider: string; model: string; free: boolean }> {
  const all = getHealthyModelList();
  const current = all.find(m => m.model === modelName);
  const freeModels = all.filter(m => m.free && m.model !== modelName);
  const sameProvider = all.filter(m => m.provider === current?.provider && m.model !== modelName && !m.free);
  const others = all.filter(m => m.model !== modelName && !m.free && m.provider !== current?.provider);
  return [...freeModels, ...sameProvider, ...others];
}
