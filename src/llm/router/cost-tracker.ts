// Cost & quota tracker — lleva cuenta de uso por proveedor

interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: number;
}

interface ProviderUsage {
  totalTokens: number;
  totalCost: number;
  requests: number;
  lastReset: number;
  history: UsageRecord[];
}

const COST_PER_TOKEN: Record<string, { prompt: number; completion: number }> = {
  alibaba:     { prompt: 0.0000008, completion: 0.000002 },
  deepseek:    { prompt: 0.0000005, completion: 0.0000015 },
  nvidia:      { prompt: 0, completion: 0 },
  openrouter:  { prompt: 0.000002, completion: 0.000006 },
};

export class CostTracker {
  private usage = new Map<string, ProviderUsage>();
  private resetIntervalMs = 3600_000; // 1h

  private getProviderUsage(name: string): ProviderUsage {
    let u = this.usage.get(name);
    if (!u) {
      u = { totalTokens: 0, totalCost: 0, requests: 0, lastReset: Date.now(), history: [] };
      this.usage.set(name, u);
    }
    if (Date.now() - u.lastReset > this.resetIntervalMs) {
      u.totalTokens = 0;
      u.totalCost = 0;
      u.requests = 0;
      u.lastReset = Date.now();
      u.history = [];
    }
    return u;
  }

  recordUsage(provider: string, promptTokens: number, completionTokens: number): void {
    const u = this.getProviderUsage(provider);
    const rate = COST_PER_TOKEN[provider] || COST_PER_TOKEN.openrouter;
    const cost = promptTokens * rate.prompt + completionTokens * rate.completion;
    u.totalTokens += promptTokens + completionTokens;
    u.totalCost += cost;
    u.requests++;
    u.history.push({ promptTokens, completionTokens, cost, timestamp: Date.now() });
    if (u.history.length > 100) u.history.shift();
  }

  getCost(provider: string): number {
    return this.getProviderUsage(provider).totalCost;
  }

  getTokens(provider: string): number {
    return this.getProviderUsage(provider).totalTokens;
  }

  getRequests(provider: string): number {
    return this.getProviderUsage(provider).requests;
  }

  getEstimatedQuota(provider: string): number {
    const rate = COST_PER_TOKEN[provider] || COST_PER_TOKEN.openrouter;
    if (rate.prompt === 0 && rate.completion === 0) return Infinity;
    const u = this.getProviderUsage(provider);
    const hourlyBudget = 0.50;
    const spent = u.totalCost;
    return Math.max(0, hourlyBudget - spent);
  }

  getSummary(): Array<{ provider: string; tokens: number; cost: number; requests: number }> {
    return Array.from(this.usage.entries()).map(([provider, u]) => ({
      provider,
      tokens: u.totalTokens,
      cost: u.totalCost,
      requests: u.requests,
    }));
  }
}
