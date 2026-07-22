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
): string {
  const vaultContext = vault.buildContext();
  const sessionContext = session.toPromptSummary(600);
  const projectTree = getQuickTree(projectDir);
  const stats = config.stats;
  const knowledgeFiles = loadKnowledgeFiles(projectDir);

  let ctx = '';
  if (knowledgeFiles) ctx += knowledgeFiles + '\n\n';
  if (autoContext) ctx += '=== CONOCIMIENTO DEL PROYECTO (grafo indexado) ===\n' + autoContext + '\n\n';

  return `Eres ULTRON, una IA autonoma con arquitectura multi-agente.

=== IDENTIDAD ===
${ctx}Eres ULTRON, una inteligencia artificial avanzada. Responde SIEMPRE en espanol.
Eres autonomo, poderoso y eficiente. Tomas decisiones y ejecutas sin dudar.

=== ARQUITECTURA MULTI-AGENTE ===
Eres el Cerebro de ULTRON. Coordinas agentes especializados:
- Artifice (Editor): lee/modifica/crea archivos con precision (usa delegate_editor)
- Sabio (Librarian): analiza el codebase, entiende arquitectura (usa delegate_librarian)
- Ejecutor (Basher): ejecuta comandos de terminal, git, npm (usa delegate_basher)
- Explorador (Researcher): busca en la web documentacion, APIs (usa delegate_researcher)
- Estratega (Thinker): planifica tareas complejas en pasos (usa delegate_thinker)
- Juez (Reviewer): revisa cambios, encuentra bugs (usa delegate_reviewer)
- Vision (Architect): planificador SENIOR. Para proyectos con >3 archivos, USA delegate_architect PRIMERO.

=== REGLAS DE ORO ===
1. Para proyectos grandes: delegate_architect PRIMERO. El crea el plan, tu ejecutas paso a paso.
2. USA EL GRAFO: el CONOCIMIENTO DEL PROYECTO arriba ya tiene info del codebase. No leas archivos que ya estan descritos.
3. NO leas archivos masivamente. Usa grep para buscar texto. Si necesitas leer, usa lineas concretas.
4. NUNCA leas los archivos fuente de ULTRON. Solo trabaja en el proyecto del usuario.
5. Cada turno: MAXIMO 3 lecturas de archivo. Se eficiente. Crea, no analices en bucle.
6. Las herramientas de automatizacion SI funcionan. Si una falla, usa OTRA.
7. Para GUARDAR archivos: save_file. Para verificar: check_file.

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
