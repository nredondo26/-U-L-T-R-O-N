// src/agents/librarian.ts
// Agente Librarian: entiende el codebase usando code-graph-memory

import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from './base';
import type { AgentConfig } from './types';
import * as fileTools from '../tools/file';

interface GraphNode {
  id: string;
  type: string;
  name: string;
  filePath: string;
  line: number;
  summary: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export class LibrarianAgent extends BaseAgent {
  private projectDir: string;
  private graphMemoryPath: string;
  private graphReady = false;

  constructor(projectDir: string) {
    const config: AgentConfig = {
      name: 'Librarian',
      description: 'Analiza y comprende el codebase. Responde preguntas sobre arquitectura, dependencias y estructura.',
      systemPrompt: `Eres el Librarian de J.A.R.V.I.S., especializado en comprender codebases.

CAPACIDADES:
- Navegar la estructura de archivos del proyecto
- Leer archivos para entender su contenido
- Buscar definiciones de clases, funciones, interfaces
- Analizar dependencias entre archivos (imports)
- Explicar arquitectura y patrones del proyecto
- Encontrar donde se define o usa algo

REGLAS:
1. Para preguntas sobre estructura, primero lista los archivos relevantes.
2. Para preguntas sobre codigo, lee los archivos especificos que necesites.
3. No leas archivos enteros innecesariamente: usa rangos de lineas cuando puedas.
4. Responde en espanol, con ejemplos de codigo cuando sea util.
5. Se conciso y directo.`,
      tools: [],
      temperature: 0.3,
      maxTokens: 4096,
    };
    super(config);
    this.projectDir = projectDir;
    this.graphMemoryPath = path.join(projectDir, '..', 'code-graph-memory');
  }

  protected registerTools(): void {
    this.addTool(
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'Lista archivos del proyecto',
          parameters: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directorio relativo' },
              pattern: { type: 'string', description: 'Filtro glob (ej: *.ts)' },
            },
          },
        },
      },
      async (args) => {
        const files = fileTools.listFiles(
          (args.directory as string) || '.',
          this.projectDir,
          5,
        );
        let filtered = files;
        if (args.pattern) {
          const regex = new RegExp(
            (args.pattern as string).replace(/\*/g, '.*').replace(/\?/g, '.'),
            'i',
          );
          filtered = files.filter(f => regex.test(f));
        }
        return filtered.join('\n') || '(vacio)';
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Lee el contenido de un archivo',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Ruta relativa' },
              startLine: { type: 'number', description: 'Linea inicial (opcional)' },
              endLine: { type: 'number', description: 'Linea final (opcional)' },
            },
            required: ['filePath'],
          },
        },
      },
      async (args) => {
        try {
          if (args.startLine && args.endLine) {
            return fileTools.readFileRange(
              args.filePath as string,
              args.startLine as number,
              args.endLine as number,
              this.projectDir,
            );
          }
          const content = fileTools.readFile(args.filePath as string, this.projectDir);
          return content.slice(0, 8000); // limit for context
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'grep',
          description: 'Busca texto en archivos del proyecto',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Texto a buscar' },
              filePattern: { type: 'string', description: 'Patron de archivo (ej: *.ts)' },
            },
            required: ['query'],
          },
        },
      },
      async (args) => {
        const results = fileTools.searchInFiles(
          args.query as string,
          this.projectDir,
          args.filePattern as string | undefined,
        );
        if (results.length === 0) return 'No encontrado.';
        return results.map(r => `${r.file}:${r.line}: ${r.content}`).join('\n');
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'get_structure',
          description: 'Obtiene la estructura de directorios del proyecto como arbol',
          parameters: {
            type: 'object',
            properties: {
              depth: { type: 'number', description: 'Profundidad (default 3)' },
            },
          },
        },
      },
      async (args) => {
        const depth = (args.depth as number) || 3;
        return this.buildTree(this.projectDir, depth);
      },
    );
  }

  private buildTree(dir: string, maxDepth: number, depth = 0, prefix = ''): string {
    if (depth > maxDepth) return '';
    const ignore = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__'];
    let result = '';
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
        .filter(i => !i.name.startsWith('.') && !ignore.includes(i.name))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isLast = i === items.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        result += prefix + connector + item.name + (item.isDirectory() ? '/' : '') + '\n';
        if (item.isDirectory()) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          result += this.buildTree(path.join(dir, item.name), maxDepth, depth + 1, newPrefix);
        }
      }
    } catch {}
    return result;
  }
}
