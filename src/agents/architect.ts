// src/agents/architect.ts
// Architect agent: planificacion profunda de proyectos grandes
// Similar to Thinker but produces structured, executable plans

import { BaseAgent } from './base';
import type { AgentConfig } from './types';

interface ProjectPlan {
  name: string;
  description: string;
  stack: string[];
  phases: ProjectPhase[];
  totalSteps: number;
  estimatedTime: string;
}

interface ProjectPhase {
  name: string;
  description: string;
  steps: ProjectStep[];
}

interface ProjectStep {
  action: string;
  agent: string;
  files: string[];
  description: string;
  dependsOn: number[];
  done: boolean;
}

export class ArchitectAgent extends BaseAgent {
  private lastPlan: ProjectPlan | null = null;

  constructor() {
    const config: AgentConfig = {
      name: 'Architect',
      description: 'Planificador senior de proyectos. Analiza requerimientos largos y produce planes estructurados fase por fase.',
      systemPrompt: `Eres el Architect de ULTRON, un planificador senior de software.

CAPACIDADES:
- Analizar requerimientos largos y complejos
- Descomponer proyectos en fases y pasos concretos
- Asignar el agente correcto a cada paso
- Identificar dependencias entre pasos
- Estimar complejidad y tiempo

REGLAS:
1. Lee TODOS los requerimientos del usuario antes de planificar.
2. Agrupa tareas en fases logicas (Setup, Backend, Frontend, Testing, Deploy).
3. Cada paso debe ser CONCRETO y ACCIONABLE.
4. Asigna agente: Editor (codigo), Basher (comandos), Librarian (analisis).
5. Identifica dependencias: que paso debe completarse antes que otro.
6. NO asumas nada - si falta informacion, preguntala.
7. Usa el formato JSON estructurado.`,
      tools: [],
      temperature: 0.4,
      maxTokens: 4096,
    };
    super(config);
  }

  protected registerTools(): void {}

  async createPlan(requirements: string): Promise<ProjectPlan> {
    const prompt = `Analiza los siguientes requerimientos de proyecto y crea un plan de ejecucion detallado.

REQUERIMIENTOS:
${requirements.slice(0, 8000)}

Responde EXACTAMENTE en este formato JSON (sin texto adicional):
{
  "name": "NombreDelProyecto",
  "description": "Descripcion breve",
  "stack": ["Tecnologia1", "Tecnologia2"],
  "phases": [
    {
      "name": "Fase 1: Setup",
      "description": "Configuracion inicial",
      "steps": [
        {
          "action": "Crear package.json",
          "agent": "Editor",
          "files": ["package.json"],
          "description": "Inicializar proyecto con dependencias",
          "dependsOn": []
        }
      ]
    }
  ],
  "totalSteps": 1,
  "estimatedTime": "30 min"
}

IMPORTANTE:
- Las fases deben ser logicas: Setup, Backend, Frontend, Database, Testing, Deploy
- Cada paso debe especificar que archivos crear/modificar
- dependsOn: array de indices de pasos que deben completarse antes (0 = sin dependencias)
- Se realista con los tiempos estimados`;

    const result = await this.run(prompt);
    try {
      const json = result.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      const plan = JSON.parse(json) as ProjectPlan;
      this.lastPlan = plan;
      return plan;
    } catch {
      this.lastPlan = {
        name: 'Proyecto',
        description: requirements.slice(0, 100),
        stack: [],
        phases: [{ name: 'Setup', description: 'Inicio', steps: [] }],
        totalSteps: 0,
        estimatedTime: 'N/A',
      };
      return this.lastPlan;
    }
  }

  getLastPlan(): ProjectPlan | null { return this.lastPlan; }

  formatPlan(plan?: ProjectPlan): string {
    const p = plan || this.lastPlan;
    if (!p) return 'No hay plan activo.';

    let out = `PLAN: ${p.name}\n${p.description}\nStack: ${p.stack.join(', ')}\nTiempo estimado: ${p.estimatedTime}\n`;

    let stepNum = 0;
    for (const phase of p.phases) {
      out += `\n  ${phase.name}\n  ${phase.description}\n`;
      for (const step of phase.steps) {
        stepNum++;
        const deps = step.dependsOn.length > 0 ? ` [deps: ${step.dependsOn.join(',')}]` : '';
        out += `    ${stepNum}. [${step.agent}] ${step.action} → ${step.files.join(', ')}${deps}\n`;
      }
    }

    return out;
  }
}
