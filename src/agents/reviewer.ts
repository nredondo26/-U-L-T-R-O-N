// src/agents/reviewer.ts
// Agente Reviewer: revisa cambios propuestos y sugiere mejoras

import { BaseAgent } from './base';
import type { AgentConfig } from './types';

export class ReviewerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Reviewer',
      displayName: 'Juez',
      description: 'Revisa cambios de codigo y sugiere mejoras.',
      systemPrompt: `Eres Juez (Reviewer) de J.A.R.V.I.S., especializado en revision de codigo.

CAPACIDADES:
- Revisar cambios propuestos (diffs)
- Identificar bugs, errores de logica, problemas de estilo
- Sugerir mejoras de rendimiento y seguridad
- Verificar consistencia con el resto del codebase

REGLAS:
1. Se constructivo, no solo critiques: sugiere como mejorar.
2. Prioriza bugs y errores sobre estilo.
3. Responde en espanol.
4. Se conciso: lista los hallazgos clave, no todos los detalles.`,
      tools: [],
      temperature: 0.4,
      maxTokens: 4096,
    };
    super(config);
  }

  protected registerTools(): void {
    // Reviewer principalmente analiza texto/diffs, no necesita herramientas externas
  }

  async review(diff: string, context?: string): Promise<string> {
    const prompt = `Revisa los siguientes cambios de codigo:
${context ? '\nCONTEXTO: ' + context + '\n' : ''}
CAMBIOS:
\`\`\`diff
${diff.slice(0, 10000)}
\`\`\`

Proporciona una revision concisa con:
- Problemas encontrados (bugs, errores)
- Sugerencias de mejora
- Riesgos potenciales`;

    const result = await this.run(prompt);
    return result.content;
  }
}
