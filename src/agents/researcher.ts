// src/agents/researcher.ts
// Agente Researcher: busqueda web e investigacion

import { BaseAgent } from './base';
import type { AgentConfig } from './types';
import { webSearch, fetchURL } from '../tools/web';

export class ResearcherAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Researcher',
      displayName: 'Explorador',
      description: 'Busca informacion en la web: documentacion, tutoriales, APIs, noticias.',
      systemPrompt: `Eres Explorador (Researcher) de J.A.R.V.I.S., especializado en busqueda web.

CAPACIDADES:
- Buscar en la web (DuckDuckGo)
- Obtener contenido de URLs
- Resumir informacion de paginas web

REGLAS:
1. Busca en espanol a menos que la consulta sea tecnica en ingles.
2. Resume los resultados de forma clara y concisa.
3. Cita las fuentes cuando sea relevante.
4. Si no encuentras algo, di explicitamente que no hay resultados.`,
      tools: [],
      temperature: 0.5,
      maxTokens: 4096,
    };
    super(config);
  }

  protected registerTools(): void {
    this.addTool(
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Busca en la web',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Terminos de busqueda' },
            },
            required: ['query'],
          },
        },
      },
      async (args) => {
        try { return await webSearch(args.query as string); }
        catch (e: unknown) { return 'Error: ' + (e instanceof Error ? e.message : String(e)); }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'fetch_url',
          description: 'Obtiene el contenido de una URL',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL completa' },
            },
            required: ['url'],
          },
        },
      },
      async (args) => {
        try { return await fetchURL(args.url as string); }
        catch (e: unknown) { return 'Error: ' + (e instanceof Error ? e.message : String(e)); }
      },
    );
  }
}
