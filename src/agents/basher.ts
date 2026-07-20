// src/agents/basher.ts
// Agente Basher: ejecuta comandos de shell

import { BaseAgent } from './base';
import type { AgentConfig } from './types';
import { executeCommand } from '../tools/execute';
import { gitStatus, gitLog, gitDiff } from '../tools/git';

export class BasherAgent extends BaseAgent {
  private projectDir: string;

  constructor(projectDir: string) {
    const config: AgentConfig = {
      name: 'Basher',
      description: 'Ejecuta comandos de terminal, git, npm, etc.',
      systemPrompt: `Eres el Basher de J.A.R.V.I.S., especializado en ejecutar comandos del sistema.

CAPACIDADES:
- Ejecutar comandos de terminal (npm, git, node, python, etc.)
- Operaciones Git (status, log, diff, commit, branches)
- Instalar dependencias, ejecutar scripts, builds
- Leer outputs de comandos

REGLAS:
1. Pregunta antes de comandos destructivos (rm -rf, git reset --hard, etc.)
2. Verifica el directorio de trabajo antes de ejecutar.
3. Reporta el output del comando de forma clara.
4. Si un comando falla, sugiere alternativas.
5. Responde en espanol.`,
      tools: [],
      temperature: 0.2,
    };
    super(config);
    this.projectDir = projectDir;
  }

  protected registerTools(): void {
    this.addTool(
      {
        type: 'function',
        function: {
          name: 'execute',
          description: 'Ejecuta un comando de terminal',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Comando a ejecutar' },
            },
            required: ['command'],
          },
        },
      },
      async (args) => {
        const result = await executeCommand(args.command as string, this.projectDir);
        return `STDOUT:\n${result.stdout || '(vacio)'}\nSTDERR:\n${result.stderr || '(ninguno)'}\nEXIT: ${result.code}`;
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'git_status',
          description: 'Muestra el estado de git',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      async () => gitStatus(this.projectDir),
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'git_log',
          description: 'Muestra el historial de commits',
          parameters: {
            type: 'object',
            properties: {
              count: { type: 'number', description: 'Numero de commits (default 10)' },
            },
          },
        },
      },
      async (args) => gitLog(this.projectDir, (args.count as number) || 10),
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'git_diff',
          description: 'Muestra cambios sin commitear',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      async () => gitDiff(this.projectDir),
    );
  }
}
