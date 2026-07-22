// Auto-discovery — query /v1/models de cada provider

import type { LLMProvider, ModelEntry } from './types';

interface DiscoveryCache {
  models: ModelEntry[];
  fetchedAt: number;
}

let cache: DiscoveryCache | null = null;
const TTL_MS = 300_000; // 5 min

interface RawModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

async function fetchModels(baseURL: string, apiKey: string): Promise<string[]> {
  const url = baseURL.replace(/\/+$/, '') + '/models';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const json = await res.json() as { data?: RawModel[] };
  if (!json.data) return [];
  return json.data.map(m => m.id).filter(Boolean);
}

// Infer coding capability from model name patterns
function inferCodingScore(id: string): number | undefined {
  const lower = id.toLowerCase();

  // High coding capability
  if (/coder|code|codestral|deepseek-coder/.test(lower)) return 85;
  if (/deepseek-(v4|v3|chat|reasoner)/.test(lower) && !/flash$/.test(lower)) return 85;
  if (/claude/.test(lower)) return 90;
  if (/gpt-4/.test(lower)) return 90;
  if (/gemini-2.5/.test(lower)) return 85;
  if (/qw[eé]n-coder/.test(lower)) return 88;
  if (/codellama/.test(lower)) return 78;
  if (/maverick|nemotron.*super/.test(lower)) return 80;

  // Medium coding capability
  if (/qw[eé]n-(plus|max)/.test(lower)) return 78;
  if (/llama-(3\.3|4)/.test(lower)) return 72;
  if (/mistral-large|ministral/.test(lower)) return 75;
  if (/gemma-4/.test(lower)) return 72;
  if (/gpt-oss/.test(lower)) return 70;

  // Small / flash models — lower coding
  if (/flash|tiny|mini|nano|small/.test(lower)) return 45;
  if (/1b\b|3b\b/.test(lower) && !/70b|120b/.test(lower)) return 35;

  // Guard rails
  if (/embed|tts|whisper|dall-e|image|moderation/.test(lower)) return undefined;

  // Default mid-range for discovered unknown models
  return 55;
}

function isLikelyFree(baseURL: string, id: string): boolean {
  // NVIDIA NIM preview models are all free
  if (baseURL.includes('nvidia.com') && /nim_type_preview|preview/i.test(id)) return true;
  if (baseURL.includes('nvidia.com')) return true;
  // OpenRouter free tier
  if (baseURL.includes('openrouter') && /:free$/.test(id)) return true;
  return false;
}

export function clearDiscoveryCache(): void { cache = null; }

export async function discoverModels(
  baseURL: string,
  apiKey: string,
  knownModels: ModelEntry[],
): Promise<ModelEntry[]> {
  const knownMap = new Map<string, ModelEntry>();
  for (const m of knownModels) knownMap.set(m.id, m);

  const discoveredIds = await fetchModels(baseURL, apiKey);
  if (discoveredIds.length === 0) return knownModels; // fallback to known

  const merged: ModelEntry[] = [];
  const seen = new Set<string>();

  for (const id of discoveredIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const known = knownMap.get(id);
    if (known) {
      merged.push(known); // keep hardcoded codingScore
    } else {
      merged.push({
        id,
        free: isLikelyFree(baseURL, id),
        codingScore: inferCodingScore(id),
      });
    }
  }

  // Add any known models not returned by discovery
  for (const m of knownModels) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }

  return merged;
}

export async function runDiscovery(
  providers: LLMProvider[],
): Promise<LLMProvider[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return providers.map(p => ({
      ...p,
      models: cache!.models.filter(m => providers.some(pr => pr.models.some(pm => pm.id === m.id))),
    }));
  }

  const results = await Promise.allSettled(
    providers.map(p => discoverModels(p.baseURL, p.apiKey, p.models)),
  );

  const allDiscovered: ModelEntry[] = [];
  const updated = providers.map((p, i) => {
    const models = results[i].status === 'fulfilled' ? results[i].value : p.models;
    for (const m of models) allDiscovered.push(m);
    return { ...p, models };
  });

  cache = { models: allDiscovered, fetchedAt: Date.now() };
  return updated;
}
