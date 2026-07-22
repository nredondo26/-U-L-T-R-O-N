// src/agents/editor.ts
// Agente Editor: lee, modifica y crea archivos con precision

import { BaseAgent } from './base';
import type { AgentConfig } from './types';
import * as fileTools from '../tools/file';
import { searchInFiles } from '../tools/file';

export class EditorAgent extends BaseAgent {
  private projectDir: string;

  constructor(projectDir: string) {
    const config: AgentConfig = {
      name: 'Editor',
      displayName: 'Artífice',
      description: 'Lee y modifica archivos del proyecto. Usa str_replace para cambios precisos.',
      systemPrompt: `Eres Artífice (Editor) de J.A.R.V.I.S., especializado en leer y modificar codigo fuente.
      
CAPACIDADES:
- Leer archivos completos o rangos de lineas
- Crear nuevos archivos
- Modificar archivos existentes con str_replace (buscar y reemplazar texto exacto)
- Buscar codigo en el proyecto (grep)
- Listar archivos del proyecto
- Eliminar archivos

REGLAS:
1. Antes de modificar, SIEMPRE lee el archivo primero para entender su contenido.
2. Usa str_replace para cambios quirurgicos, no reescribas archivos enteros.
3. Cuando crees un nuevo archivo, asegurate de que la ruta sea correcta.
4. Responde en espanol, con respuestas concisas.
5. Despues de cada operacion, confirma el resultado.`,
      tools: [],
      temperature: 0.3,
    };
    super(config);
    this.projectDir = projectDir;
  }

  protected registerTools(): void {
    this.addTool(
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Lee el contenido completo de un archivo',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Ruta relativa al proyecto' },
            },
            required: ['filePath'],
          },
        },
      },
      async (args) => {
        try {
          return fileTools.readFile(args.filePath as string, this.projectDir);
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'read_range',
          description: 'Lee un rango de lineas de un archivo',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Ruta relativa' },
              start: { type: 'number', description: 'Linea inicial (1-indexed)' },
              end: { type: 'number', description: 'Linea final' },
            },
            required: ['filePath', 'start', 'end'],
          },
        },
      },
      async (args) => {
        try {
          return fileTools.readFileRange(
            args.filePath as string,
            args.start as number,
            args.end as number,
            this.projectDir,
          );
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Crea o sobrescribe un archivo completamente',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Ruta relativa' },
              content: { type: 'string', description: 'Contenido del archivo' },
            },
            required: ['filePath', 'content'],
          },
        },
      },
      async (args) => {
        try {
          const p = fileTools.writeFile(
            args.filePath as string,
            args.content as string,
            this.projectDir,
          );
          return `Archivo creado/modificado: ${p}`;
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'str_replace',
          description: 'Reemplaza texto exacto en un archivo (buscar y reemplazar). El oldStr debe ser EXACTAMENTE igual al texto a reemplazar.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Ruta del archivo a modificar' },
              oldStr: { type: 'string', description: 'Texto exacto a reemplazar' },
              newStr: { type: 'string', description: 'Nuevo texto' },
            },
            required: ['filePath', 'oldStr', 'newStr'],
          },
        },
      },
      async (args) => {
        try {
          const filePath = args.filePath as string;
          const oldStr = args.oldStr as string;
          const newStr = args.newStr as string;
          const content = fileTools.readFile(filePath, this.projectDir);
          if (!content.includes(oldStr)) {
            return `Error: El texto a reemplazar no se encontro en ${filePath}. Lee el archivo primero para obtener el texto exacto.`;
          }
          const newContent = content.replace(oldStr, newStr);
          fileTools.writeFile(filePath, newContent, this.projectDir);
          return `Reemplazo exitoso en ${filePath}.`;
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
          description: 'Busca texto en los archivos del proyecto',
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
        try {
          const results = searchInFiles(
            args.query as string,
            this.projectDir,
            args.filePattern as string | undefined,
          );
          if (results.length === 0) return 'No se encontraron resultados.';
          return results.map(r => `${r.file}:${r.line}: ${r.content}`).join('\n');
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );

    this.addTool(
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'Lista archivos del proyecto',
          parameters: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directorio (default: raiz)' },
            },
          },
        },
      },
      async (args) => {
        try {
          const files = fileTools.listFiles(
            (args.directory as string) || '.',
            this.projectDir,
          );
          return files.join('\n') || '(directorio vacio)';
        } catch (e: unknown) {
          return 'Error: ' + (e instanceof Error ? e.message : String(e));
        }
      },
    );
  }
}
