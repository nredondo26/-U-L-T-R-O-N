// Tier Fallback System — subscription → cheap → free
// Inspirado en 9Router: smart 3-tier fallback con tracking de cuotas

export type Tier = 'subscription' | 'cheap' | 'free' | 'api';

export interface TieredProvider {
  name: string;
  tier: Tier;
  models: string[];
  baseURL: string;
  apiKey: string;
  quotaResetMs: number;
  quotaUsed: number;
  quotaMax: number;
  lastReset: number;
  costPer1M?: number;
}

const providers: TieredProvider[] = [];
let lastInit = 0;

function initTiers(): void {
  if (Date.now() - lastInit < 5000 && providers.length > 0) return;
  providers.length = 0;
  lastInit = Date.now();

  const { getProviders } = require('./providers');
  const all = getProviders();

  for (const p of all) {
    const models = p.models.map((m: any) => m.id);
    let tier: Tier = 'api';
    let costPer1M: number | undefined;

    // Classify by provider name and models
    const name = p.name.toLowerCase();
    if (name === 'deepseek') { tier = 'cheap'; costPer1M = 0.5; }
    else if (name === 'nvidia') { tier = 'free'; costPer1M = 0; }
    else if (name === 'dashscope' || name === 'alibaba') { tier = 'api'; costPer1M = 1; }
    else if (name === 'openrouter') { tier = 'api'; costPer1M = 2; }
    else { tier = 'api'; }

    providers.push({
      name: p.name,
      tier,
      models,
      baseURL: p.baseURL,
      apiKey: p.apiKey,
      quotaResetMs: 3600000,
      quotaUsed: 0,
      quotaMax: 1000000,
      lastReset: Date.now(),
      costPer1M,
    });
  }
}

export function getTieredProviders(): TieredProvider[] {
  initTiers();
  return [...providers];
}

export function getBestAvailableModel(preferredModel?: string): { model: string; provider: string; tier: Tier } | null {
  initTiers();

  // 1. If preferred model is specified and available, use it
  if (preferredModel) {
    for (const p of providers) {
      if (p.models.includes(preferredModel)) {
        checkQuotaReset(p);
        if (p.quotaUsed < p.quotaMax) return { model: preferredModel, provider: p.name, tier: p.tier };
      }
    }
  }

  // 2. Try subscription tier first
  for (const p of providers) {
    if (p.tier !== 'subscription') continue;
    checkQuotaReset(p);
    if (p.quotaUsed < p.quotaMax) {
      return { model: p.models[0], provider: p.name, tier: p.tier };
    }
  }

  // 3. Cheap tier
  for (const p of providers) {
    if (p.tier !== 'cheap') continue;
    checkQuotaReset(p);
    if (p.quotaUsed < p.quotaMax) {
      return { model: p.models[0], provider: p.name, tier: p.tier };
    }
  }

  // 4. Free tier
  for (const p of providers) {
    if (p.tier !== 'free') continue;
    checkQuotaReset(p);
    if (p.quotaUsed < p.quotaMax) {
      return { model: p.models[0], provider: p.name, tier: p.tier };
    }
  }

  // 5. Any API with remaining quota
  for (const p of providers) {
    checkQuotaReset(p);
    if (p.quotaUsed < p.quotaMax) {
      return { model: p.models[0], provider: p.name, tier: p.tier };
    }
  }

  return null;
}

function checkQuotaReset(p: TieredProvider): void {
  if (Date.now() - p.lastReset > p.quotaResetMs) {
    p.quotaUsed = 0;
    p.lastReset = Date.now();
  }
}

export function recordTierUsage(providerName: string, tokens: number): void {
  const p = providers.find(pr => pr.name === providerName);
  if (p) p.quotaUsed += tokens;
}

export function getFallbackChain(model: string): Array<{ model: string; provider: string; tier: Tier }> {
  initTiers();
  const chain: Array<{ model: string; provider: string; tier: Tier }> = [];

  // Preferred model first
  for (const p of providers) {
    if (p.models.includes(model)) {
      chain.push({ model, provider: p.name, tier: p.tier });
      break;
    }
  }

  // Group by tier
  const tierOrder: Tier[] = ['subscription', 'cheap', 'free', 'api'];
  for (const tier of tierOrder) {
    for (const p of providers) {
      if (p.tier !== tier) continue;
      if (chain.some(c => c.provider === p.name)) continue; // already added
      if (p.models.length === 0) continue;
      chain.push({ model: p.models[0], provider: p.name, tier: p.tier });
    }
  }

  return chain;
}
