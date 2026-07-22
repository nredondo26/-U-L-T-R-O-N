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
  const results: TestResult[] = [];

  let tested = 0;
  const total = allModels.length;

  for (const p of providers) {
    const providerModels = allModels.filter(m => m.provider === p.name);
    if (providerModels.length === 0) continue;

    for (const m of providerModels) {
      tested++;
      const start = Date.now();
      try {
        const res = await fetch(`${p.baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, temperature: 0 }),
          signal: AbortSignal.timeout(15000),
        });
        const ms = Date.now() - start;
        if (res.ok) {
          const r: TestResult = { model: m.model, provider: p.name, ok: true, ms };
          results.push(r);
          onProgress?.(r);
        } else {
          let err = `HTTP ${res.status}`;
          try { const b = await res.json() as Record<string, unknown>; const e = b?.error as { message?: string } | undefined; if (e?.message) err = e.message; } catch {}
          const r: TestResult = { model: m.model, provider: p.name, ok: false, ms, error: err };
          results.push(r);
          onProgress?.(r);
        }
      } catch (e: unknown) {
        const ms = Date.now() - start;
        const r: TestResult = { model: m.model, provider: p.name, ok: false, ms, error: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
        results.push(r);
        onProgress?.(r);
      }
    }
  }

  const working = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);

  return `${working.length}/${total} modelos accesibles. Usa /model <id> para cambiar.`;
}
