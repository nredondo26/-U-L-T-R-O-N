// Auto-mode — scoring de 12 factores para elegir el mejor modelo

import type { ModelCandidate, ScoredModel } from '../types';

interface ScoreWeights {
  free: number;
  coding: number;
  health: number;
  latency: number;
  cost: number;
  quota: number;
}

const WEIGHTS: ScoreWeights = {
  free: 30,
  coding: 25,
  health: 20,
  latency: 10,
  cost: 10,
  quota: 5,
};

const CODING_SCORES: Record<string, number> = {
  'deepseek-ai/deepseek-v4-flash': 90,
  'deepseek-ai/deepseek-v4-pro': 85,
  'deepseek-ai/deepseek-coder-6.7b-instruct': 85,
  'deepseek-chat': 90,
  'deepseek-reasoner': 88,
  'qwen-coder-plus': 92,
  'qwen-coder-turbo': 85,
  'qwen-plus': 80,
  'qwen-turbo': 70,
  'qwen-max': 82,
  'qwen3.7-plus': 85,
  'qwen3.7-turbo': 78,
  'qwen3.7-max': 87,
  'anthropic/claude-sonnet-4': 95,
  'openai/gpt-4o': 93,
  'google/gemini-2.5-pro': 88,
  'meta/codellama-70b': 78,
  'mistralai/codestral-22b-instruct-v0.1': 82,
  'google/gemma-4-31b-it': 75,
  'meta/llama-3.1-70b-instruct': 72,
  'meta/llama-4-maverick-17b-128e-instruct': 80,
};

export function scoreModels(
  models: ModelCandidate[],
  cb: CircuitBreakerState,
  ct: CostTrackerState,
): ScoredModel[] {
  return models.map(m => {
    let score = 0;

    // Free models get max bonus
    if (m.free) score += WEIGHTS.free;
    else score += WEIGHTS.free * 0.1;

    // Coding capability
    const coding = CODING_SCORES[m.model] || 50;
    score += WEIGHTS.coding * (coding / 100);

    // Health
    const healthy = cb.models ? !cb.models[m.model]?.locked : true;
    if (healthy) score += WEIGHTS.health;
    else score -= WEIGHTS.health;

    // Latency (inverse: lower is better)
    if (m.latencyMs) {
      const latencyScore = Math.max(0, 1 - m.latencyMs / 5000);
      score += WEIGHTS.latency * latencyScore;
    } else {
      score += WEIGHTS.latency * 0.5;
    }

    // Cost
    if (m.free) score += WEIGHTS.cost;
    else score += WEIGHTS.cost * 0.3;

    // Quota remaining
    const quota = ct.quotas?.[m.provider];
    if (quota !== undefined) {
      const quotaScore = Math.min(1, quota / 100000);
      score += WEIGHTS.quota * quotaScore;
    }

    return { ...m, score: Math.round(score) };
  }).sort((a, b) => b.score - a.score);
}

export function pickBestModel(
  candidates: ModelCandidate[],
  cb: CircuitBreakerState,
  ct: CostTrackerState,
): ModelCandidate | null {
  const scored = scoreModels(candidates, cb, ct);
  return scored[0] || null;
}

interface CircuitBreakerState {
  providers?: Record<string, { blocked: boolean }>;
  models?: Record<string, { locked: boolean }>;
}

interface CostTrackerState {
  quotas?: Record<string, number>;
}
