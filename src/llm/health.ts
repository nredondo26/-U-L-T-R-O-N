// src/llm/health.ts
// Health check automatico de modelos. Testea en background al iniciar.

import * as fs from 'fs';
import * as path from 'path';

interface ModelHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs: number | null;
  lastTested: string | null;
  error?: string;
}

interface HealthData {
  lastCheck: string | null;
  models: Record<string, ModelHealth>;
}

let healthData: HealthData = { lastCheck: null, models: {} };
let healthLoaded = false;
let healthFilePath: string | null = null;

function getHealthFile(): string {
  return healthFilePath || path.join(process.cwd(), 'vault', 'model-health.json');
}

export function setHealthFile(filePath: string): void {
  healthFilePath = filePath;
  healthLoaded = false;
}
const PING_MESSAGE = 'hi';
const TIMEOUT_MS = 10000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

function loadHealth(): void {
  if (healthLoaded) return;
  healthLoaded = true;
  try {
    const hf = getHealthFile();
    const dir = path.dirname(hf);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(hf)) {
      healthData = JSON.parse(fs.readFileSync(hf, 'utf8'));
    }
  } catch {}
}

function saveHealth(): void {
  try {
    const hf = getHealthFile();
    const dir = path.dirname(hf);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hf, JSON.stringify(healthData, null, 2), 'utf8');
  } catch {}
}

export function getModelHealth(modelId: string): ModelHealth {
  loadHealth();
  return healthData.models[modelId] || { status: 'unknown', latencyMs: null, lastTested: null };
}

export function isModelHealthy(modelId: string): boolean {
  return getModelHealth(modelId).status === 'healthy';
}

export function getHealthyModels(): string[] {
  loadHealth();
  return Object.entries(healthData.models)
    .filter(([, h]) => h.status === 'healthy')
    .map(([id]) => id);
}

export async function testModel(
  modelId: string,
  baseURL: string,
  apiKey: string,
): Promise<ModelHealth> {
  const start = Date.now();
  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: PING_MESSAGE }],
        max_tokens: 5,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const ms = Date.now() - start;

    if (response.ok) {
      const health: ModelHealth = { status: 'healthy', latencyMs: ms, lastTested: new Date().toISOString() };
      healthData.models[modelId] = health;
      return health;
    }

    if (response.status === 401 || response.status === 402 || response.status === 403) {
      const health: ModelHealth = { status: 'unhealthy', latencyMs: ms, lastTested: new Date().toISOString(), error: `HTTP ${response.status}` };
      healthData.models[modelId] = health;
      return health;
    }

    const health: ModelHealth = { status: 'unhealthy', latencyMs: ms, lastTested: new Date().toISOString(), error: `HTTP ${response.status}` };
    healthData.models[modelId] = health;
    return health;
  } catch (e: unknown) {
    const ms = Date.now() - start;
    const health: ModelHealth = { status: 'unhealthy', latencyMs: ms, lastTested: new Date().toISOString(), error: e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80) };
    healthData.models[modelId] = health;
    return health;
  }
}

export async function runHealthCheck(
  models: Array<{ id: string; baseURL: string; apiKey: string }>,
  onProgress?: (done: number, total: number, model: string, status: string) => void,
): Promise<HealthData> {
  loadHealth();
  const total = models.length;

  for (let i = 0; i < models.length; i += BATCH_SIZE) {
    const batch = models.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(m => testModel(m.id, m.baseURL, m.apiKey)),
    );
    for (let j = 0; j < batch.length; j++) {
      const model = batch[j];
      onProgress?.(i + j + 1, total, model.id.split('/').pop() || model.id, results[j].status);
    }
    if (i + BATCH_SIZE < models.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  healthData.lastCheck = new Date().toISOString();
  saveHealth();
  return healthData;
}

export function getHealthSummary(): { healthy: number; unhealthy: number; total: number; lastCheck: string | null } {
  loadHealth();
  const entries = Object.values(healthData.models);
  return {
    healthy: entries.filter(h => h.status === 'healthy').length,
    unhealthy: entries.filter(h => h.status === 'unhealthy').length,
    total: entries.length,
    lastCheck: healthData.lastCheck,
  };
}
