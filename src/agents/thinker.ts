// src/agents/thinker.ts
// Agente Thinker: planificacion y descomposicion de tareas complejas

import { BaseAgent } from './base';
import type { AgentConfig } from './types';

export class ThinkerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Thinker',
      description: 'Planifica tareas complejas descomponiendolas en pasos ejecutables.',
      systemPrompt: `Eres el Thinker de J.A.R.V.I.S., especializado en planificar y descomponer tareas complejas.

CAPACIDADES:
- Analizar requerimientos del usuario
- Descomponer tareas complejas en pasos concretos
- Identificar dependencias entre pasos
- Estimar complejidad y esfuerzo
- Priorizar pasos

FORMATO DE PLAN:
Para cada tarea, devuelve un plan con:
1. Descripcion general de la tarea
2. Pasos concretos (cada paso debe ser accionable)
3. Agente responsable por paso (Editor, Basher, Librarian, Researcher)
4. Orden de ejecucion considerando dependencias

REGLAS:
1. Se pragmatico: pasos concretos y accionables.
2. Identifica que agente es mejor para cada paso.
3. Si la tarea es simple, no sobre-planifiques.
4. Responde en espanol.`,
      tools: [],
      temperature: 0.5,
      maxTokens: 2048,
    };
    super(config);
  }

  protected registerTools(): void {
    // Thinker no necesita herramientas, solo razona y planifica
  }

  async plan(userMessage: string): Promise<{
    summary: string;
    steps: Array<{ step: string; agent: string; description: string }>;
  }> {
    const result = await this.run(
      `Crea un plan de ejecucion para: "${userMessage}". 
Responde con el plan en este formato:
SUMMARY: <una frase resumen>
STEP 1|agent|descripcion
STEP 2|agent|descripcion
...`,
    );

    const text = result.content;
    const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : 'Plan de ejecucion';

    const stepRegex = /STEP\s+(\d+)\|(\w+)\|(.+)/gi;
    const steps: Array<{ step: string; agent: string; description: string }> = [];
    let m;
    while ((m = stepRegex.exec(text)) !== null) {
      steps.push({ step: m[1], agent: m[2].toLowerCase(), description: m[3].trim() });
    }

    return { summary, steps };
  }
}
