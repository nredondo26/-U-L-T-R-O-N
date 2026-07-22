// src/tools/web.ts
// Busqueda web via DuckDuckGo + fetch a URLs

import * as https from 'https';

export function webSearch(query: string): Promise<string> {
  return new Promise(resolve => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const results: Array<{ title: string; snippet: string }> = [];
        const regex = /class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = regex.exec(data)) !== null && results.length < 5) {
          results.push({
            title: m[2].replace(/<[^>]+>/g, '').trim(),
            snippet: m[3].replace(/<[^>]+>/g, '').trim(),
          });
        }
        if (results.length === 0) {
          const simpleRegex = /class="result__a"[^>]*>([^<]*)<\/a>/g;
          while ((m = simpleRegex.exec(data)) !== null && results.length < 5) {
            results.push({ title: m[1].trim(), snippet: '' });
          }
        }
        resolve(results.length > 0
          ? results.map(r => `- ${r.title}${r.snippet ? ': ' + r.snippet : ''}`).join('\n')
          : `Sin resultados para: ${query}`,
        );
      });
    });
    req.on('timeout', () => { req.destroy(); resolve('Error de busqueda: timeout (10s)'); });
    req.on('error', e => resolve('Error de busqueda: ' + e.message));
  });
}

export async function fetchURL(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch (e: unknown) {
    return 'Error al obtener URL: ' + (e instanceof Error ? e.message : String(e));
  }
}
