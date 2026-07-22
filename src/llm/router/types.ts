export interface ModelCandidate {
  provider: string;
  model: string;
  free: boolean;
  baseURL: string;
  apiKey: string;
  codingScore?: number;
  latencyMs?: number;
}

export interface ScoredModel extends ModelCandidate {
  score: number;
}

export type RoutingStrategy = 'auto' | 'free-first' | 'cost' | 'latency' | 'priority' | 'fusion';

export interface RouterConfig {
  strategy: RoutingStrategy;
  maxAttempts: number;
  preferFree: boolean;
  minCodingScore: number;
  fusionCount: number;
}

export const DEFAULT_CONFIG: RouterConfig = {
  strategy: 'auto',
  maxAttempts: 25,
  preferFree: true,
  minCodingScore: 30,
  fusionCount: 3,
};
