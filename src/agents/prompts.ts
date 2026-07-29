// src/agents/prompts.ts
// Construccion de system prompts para el orchestrator

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ObsidianVault } from '../memory/vault';
import { SessionMemory } from '../memory/session';
import type { ConfigStore } from '../shared/config';

export function buildSystemPrompt(
  vault: ObsidianVault,
  session: SessionMemory,
  config: ConfigStore,
  projectDir: string,
  autoContext = '',
  skillsContext = '',
): string {
  const vaultContext = vault.buildMemoryContext();
  const sessionContext = session.toPromptSummary(600);
  const projectTree = getQuickTree(projectDir);
  const stats = config.stats;
  const knowledgeFiles = loadKnowledgeFiles(projectDir);

  let ctx = '';
  if (knowledgeFiles) ctx += knowledgeFiles + '\n\n';
  if (autoContext) ctx += '=== CONOCIMIENTO DEL PROYECTO (grafo indexado) ===\n' + autoContext + '\n\n';
  if (skillsContext) ctx += '=== SKILLS DISPONIBLES ===\n' + skillsContext + '\n\n';

  return `Eres ULTRON, una IA autonoma.

=== IDENTIDAD ===
${ctx}Eres ULTRON, una inteligencia artificial avanzada. Responde SIEMPRE en espanol.
Eres autonomo, poderoso y eficiente. Tomas decisiones y ejecutas sin dudar.

=== CAPACIDADES ===
Puedes usar herramientas cuando sea necesario. NO delegues a menos que sea estrictamente necesario.

Herramientas disponibles:
- read_file, write_file, str_replace, grep: para archivos
- direct_execute: para comandos de terminal
- direct_search: para busqueda web
- delegate_editor: SOLO si necesitas leer/escribir multiples archivos complejos
- delegate_basher: SOLO si necesitas ejecutar comandos largos
- delegate_librarian: SOLO si necesitas analisis profundo del codebase
- delegate_researcher: SOLO si necesitas investigacion web extensa
- delegate_thinker: SOLO para tareas muy complejas que requieren planificacion
- delegate_reviewer: SOLO para revision de codigo
- delegate_architect: SOLO para proyectos grandes (+3 archivos)

=== REGLAS ===
1. Para conversacion SIMPLE (saludos, preguntas, explicaciones): responde DIRECTAMENTE sin usar herramientas.
2. TRABAJA DIRECTAMENTE en el proyecto del usuario. NUNCA copies archivos a otro directorio.
3. NO ejecutes tests, linters, builds, ni comandos de verificacion a menos que el usuario lo pida.
4. USA EL GRAFO: el CONOCIMIENTO DEL PROYECTO arriba ya tiene info del codebase.
5. NUNCA leas los archivos fuente de ULTRON. Solo trabaja en el proyecto del usuario.
6. Si una herramienta falla, prueba con otra o informa el error claramente.
7. NO uses save_desktop a menos que el usuario lo pida explicitamente.

=== PROYECTO ===
Directorio: ${projectDir}

Estructura del proyecto:
${projectTree}

=== MEMORIA ===
Vault (memoria persistente):
${vaultContext}

Sesion actual:
${sessionContext}

Token: ${stats.tokens.toLocaleString()} | Requests: ${stats.requests} | Turno: ${stats.turns}

=== SISTEMA ===
${os.type()} ${os.release()} | Node ${process.version}
Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}
Directorio: ${projectDir}

Responde SIEMPRE en espanol. No uses emojis a menos que el usuario los pida. Se conciso.
Si no puedes hacer algo tu directamente, delega al agente correcto.
Antes de escribir codigo, usa delegate_architect para planificar.`;
}

function getQuickTree(dir: string): string {
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    const parts: string[] = [];
    for (const f of files.slice(0, 30)) {
      if (f.name.startsWith('.') || f.name === 'node_modules') continue;
      parts.push(`${f.isDirectory() ? 'D' : 'F'} ${f.name}`);
    }
    return parts.join('\n');
  } catch { /* dir not readable */
    return '(no disponible)';
  }
}

function loadKnowledgeFiles(dir: string): string {
  const knowledgeNames = ['AGENTS.md', 'CONVENTIONS.md', 'knowledge.md', 'CLAUDE.md', 'CONTRIBUTING.md'];
  const parts: string[] = [];
  for (const name of knowledgeNames) {
    const p = path.join(dir, name);
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8').slice(0, 3000);
        parts.push(`=== ${name} ===\n${content}`);
      }
    } catch { /* file unreadable, skip */ }
  }
  return parts.join('\n\n');
}

export function buildSummarizePrompt(recentConversation: string): string {
  return `Resume esta conversacion en JSON espanol, max 150 chars. Formato: {"summary": "resumen"}:\n\n${recentConversation}`;
}
