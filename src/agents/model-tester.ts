import { getProviders, getAllModels } from '../llm/providers';

interface TestResult {
  model: string;
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export async function testAllModels(
  currentModel: string,
  onProgress?: (result: TestResult) => void,
): Promise<string> {
  const providers = getProviders();
  const allModels = getAllModels();

  let tested = 0;
  const total = allModels.length;
  const BATCH = 5;

  const allResults: TestResult[] = [];

  // Group all models by provider
  const providerMap = new Map<string, Array<{ model: string; provider: string; baseURL: string; apiKey: string }>>();
  for (const m of allModels) {
    const p = providers.find(pr => pr.name === m.provider);
    if (!p) continue;
    const arr = providerMap.get(p.name) || [];
    arr.push({ model: m.model, provider: p.name, baseURL: p.baseURL, apiKey: p.apiKey });
    providerMap.set(p.name, arr);
  }

  const flatModels: Array<{ model: string; provider: string; baseURL: string; apiKey: string }> = [];
  for (const arr of providerMap.values()) flatModels.push(...arr);

  for (let i = 0; i < flatModels.length; i += BATCH) {
    const batch = flatModels.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(async (m) => {
      const start = Date.now();
      const res = await fetch(`${m.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${m.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, temperature: 0 }),
        signal: AbortSignal.timeout(15000),
      });
      const ms = Date.now() - start;
      if (res.ok) {
        const r: TestResult = { model: m.model, provider: m.provider, ok: true, ms };
        return r;
      } else {
        let err = `HTTP ${res.status}`;
        try { const b = await res.json() as Record<string, unknown>; const e = b?.error as { message?: string } | undefined; if (e?.message) err = e.message; } catch { /* keep HTTP status error */ }
        return { model: m.model, provider: m.provider, ok: false, ms, error: err } as TestResult;
      }
    }));

    for (const r of batchResults) {
      tested++;
      if (r.status === 'fulfilled') {
        allResults.push(r.value);
        onProgress?.(r.value);
      } else {
        const failedModel = batch[tested - 1];
        const errMsg = r.reason instanceof Error ? r.reason.message.slice(0, 60) : String(r.reason).slice(0, 60);
        const tr: TestResult = { model: failedModel.model, provider: failedModel.provider, ok: false, ms: 0, error: errMsg };
        allResults.push(tr);
        onProgress?.(tr);
      }
    }
  }

  const working = allResults.filter(r => r.ok);
  const failed = allResults.filter(r => !r.ok);

  return `${working.length}/${total} modelos accesibles. Usa /model <id> para cambiar.`;
}
