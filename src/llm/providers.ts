// src/llm/providers.ts
import type { LLMProvider, ModelEntry } from './types';
import { isModelHealthy, getHealthyModels } from './health';

function M(id: string, free = false): ModelEntry {
  return { id, free };
}

export function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // DeepSeek API (primario, modelos baratos)
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat',
      models: [
        M('deepseek-chat', false),
        M('deepseek-reasoner', false),
      ],
    });
  }

  // NVIDIA NIM (todos gratis con nim_type_preview)
  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY,
      defaultModel: 'deepseek-ai/deepseek-v4-flash',
      models: [
        M('deepseek-ai/deepseek-v4-flash', true),
        M('deepseek-ai/deepseek-v4-pro', true),
        M('deepseek-ai/deepseek-coder-6.7b-instruct', true),
        M('meta/llama-3.1-8b-instruct', true),
        M('meta/llama-3.1-70b-instruct', true),
        M('meta/llama-3.2-1b-instruct', true),
        M('meta/llama-3.2-3b-instruct', true),
        M('meta/llama-3.3-70b-instruct', true),
        M('meta/llama-4-maverick-17b-128e-instruct', true),
        M('meta/codellama-70b', true),
        M('nvidia/llama-3.1-nemotron-nano-8b-v1', true),
        M('nvidia/llama-3.3-nemotron-super-49b-v1', true),
        M('nvidia/llama-3.3-nemotron-super-49b-v1_5', true),
        M('nvidia/nemotron-mini-4b-instruct', true),
        M('nvidia/nemotron-3-nano-30b-a3b', true),
        M('nvidia/nemotron-3-super-120b-a12b', true),
        M('nvidia/nemotron-3-ultra-550b-a55b', true),
        M('nvidia/mistral-nemotron', true),
        M('mistralai/ministral-14b-instruct-2512', true),
        M('mistralai/mistral-large-3-675b-instruct-2512', true),
        M('mistralai/mistral-medium-3.5-128b', true),
        M('mistralai/mistral-small-4-119b-2603', true),
        M('mistralai/mixtral-8x7b-instruct-v0.1', true),
        M('mistralai/codestral-22b-instruct-v0.1', true),
        M('google/gemma-2-2b-it', true),
        M('google/gemma-3n-e2b-it', true),
        M('google/gemma-3n-e4b-it', true),
        M('google/gemma-4-31b-it', true),
        M('nvidia/dracarys-llama-3.1-70b-instruct', true),
        M('nvidia/gpt-oss-20b', true),
        M('nvidia/gpt-oss-120b', true),
        M('nvidia/laguna-xs-2.1', true),
        M('moonshotai/kimi-k2.6', true),
        M('minimax/minimax-m2.7', true),
        M('zhipu/glm-5.2', true),
        M('thinkingmachines/inkling', true),
        M('bytedance/seed-oss-36b-instruct', true),
        M('qwen/qwen3-next-80b-a3b-instruct', true),
        M('qwen/qwen3.5-122b-a10b', true),
        M('stepfun/step-3.5-flash', true),
        M('stepfun/step-3.7-flash', true),
        M('sarvam/sarvam-m', true),
        M('upstage/solar-10.7b-instruct', true),
        M('nvidia/nvidia-nemotron-nano-9b-v2', true),
      ],
    });
  }

  // OpenRouter (modelos varios, requiere creditos)
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: 'deepseek/deepseek-chat',
      models: [
        M('deepseek/deepseek-chat', false),
        M('deepseek/deepseek-r1', false),
        M('anthropic/claude-sonnet-4', false),
        M('openai/gpt-4o', false),
        M('google/gemini-2.5-pro', false),
      ],
    });
  }

  return providers;
}

export function getProvider(modelName?: string): LLMProvider | null {
  const providers = getProviders();
  if (providers.length === 0) return null;

  if (modelName) {
    return providers.find(p => p.models.some(m => m.id === modelName)) || providers[0];
  }

  return providers.find(p => p.name === 'deepseek')
    || providers.find(p => p.name === 'nvidia')
    || providers[0];
}

export function getAllModels(): Array<{ provider: string; model: string; free: boolean }> {
  return getProviders().flatMap(p => p.models.map(m => ({ provider: p.name, model: m.id, free: m.free })));
}

export function getHealthyModelList(): Array<{ provider: string; model: string; free: boolean }> {
  const healthy = new Set(getHealthyModels());
  const all = getAllModels();

  // If no health data yet, show all
  if (healthy.size === 0) return all;

  return all.filter(m => healthy.has(m.model));
}

export function getModelsForHealthCheck(): Array<{ id: string; baseURL: string; apiKey: string }> {
  const result: Array<{ id: string; baseURL: string; apiKey: string }> = [];
  const seen = new Set<string>();
  for (const p of getProviders()) {
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

  // Separate: free models first, then same provider, then rest
  const freeModels = all.filter(m => m.free && m.model !== modelName);
  const sameProvider = all.filter(m => m.provider === current?.provider && m.model !== modelName && !m.free);
  const others = all.filter(m => m.model !== modelName && !m.free && m.provider !== current?.provider);

  return [...freeModels, ...sameProvider, ...others];
}
