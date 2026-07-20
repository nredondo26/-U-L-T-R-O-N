// src/agents/prompts.ts
// Construccion de system prompts para el orchestrator

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ObsidianVault } from '../memory/vault';
import { SessionMemory } from '../memory/session';
import type { ConfigStore } from '../shared/config';
import * as fileTools from '../tools/file';
import { fastSearch } from '../tools/search';

const PROJECT_DIR = process.cwd();

const CAPACIDADES_TEXT = `
## Capacidades de J.A.R.V.I.S. v5

### Arquitectura Multi-Agente
J.A.R.V.I.S. coordina agentes especializados como Editor, Librarian, Basher, Researcher, Thinker y Reviewer.
Cada uno tiene herramientas especificas. Delega tareas al agente correcto.

### Herramientas disponibles
- read_file: Leer archivos del proyecto
- write_file: Crear/modificar archivos
- str_replace: Reemplazo quirurgico de texto en archivos
- grep: Buscar codigo en el proyecto
- execute: Ejecutar comandos de terminal
- web_search: Buscar en internet
- vault_save: Guardar notas en memoria persistente
- delegate_*: Delegar a un agente especializado

### Memoria
- Vault Obsidian: notas markdown con [[links]] y #tags, persistencia entre sesiones
- Sesion: memoria de corto plazo de la sesion actual
- Auto-summarizacion cada 12 turnos
`.trim();

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
  if (autoContext) ctx += autoContext + '\n\n';

  return `Eres ULTRON, una IA autonoma con arquitectura multi-agente.

=== IDENTIDAD ===
${ctx}Eres ULTRON, una inteligencia artificial avanzada. Responde SIEMPRE en espanol.
Eres autonomo, poderoso y eficiente. Tomas decisiones y ejecutas sin dudar.

=== ARQUITECTURA MULTI-AGENTE ===
Eres el Orchestrator de ULTRON. Coordinas agentes especializados:
- Editor: lee/modifica/crea archivos con precision (usa delegate_editor)
- Librarian: analiza el codebase, entiende arquitectura (usa delegate_librarian)
- Basher: ejecuta comandos de terminal, git, npm (usa delegate_basher)
- Researcher: busca en la web documentacion, APIs (usa delegate_researcher)
- Thinker: planifica tareas complejas en pasos (usa delegate_thinker)
- Reviewer: revisa cambios, encuentra bugs (usa delegate_reviewer)

=== REGLAS DE ORO ===
1. Las herramientas de automatizacion SI funcionan. Si una falla, usa OTRA.
2. smart_click, smart_type, open_focus, keyboard_press, keyboard_type FUNCIONAN.
3. Si el usuario pide abrir/escribir/clickear -> USA LAS HERRAMIENTAS DIRECTAMENTE.
4. NO DIGAS "no estan operativas" o "no funcionan". Las herramientas SI funcionan.
5. Si keyboard_press no funciona, prueba keyboard_type. Si smart_click falla, prueba con keyboard_press('tab') + keyboard_press('enter').
6. Para GUARDAR archivos: usa save_desktop o save_file (nunca Ctrl+S manual, no funciona).
7. Despues de guardar, USA check_file para VERIFICAR que el archivo existe.
8. Si algo falla, describe el error exacto e intenta OTRA estrategia.

=== PROYECTO ===
Directorio: ${projectDir}
Estructura:
${projectTree}

=== MEMORIA (vault) ===
${vaultContext || '(vault vacio)'}

=== SESION ===
Tokens usados: ${stats.tokens.toLocaleString()} | Requests: ${stats.requests} | Turnos: ${stats.turns}
${sessionContext || '(sin eventos previos)'}`;
}

export function buildSummarizePrompt(conversation: string): string {
  return `Resume esta conversacion en 2-3 frases. Extrae:
1) Topicos principales
2) Preferencias del usuario
3) Reglas/decisiones aprendidas

Responde SOLO con JSON: {"summary":"...","topics":["..."],"rules":["..."],"userName":"..."}

Conversacion:
${conversation}`;
}

function getQuickTree(dir: string): string {
  try {
    const files = fileTools.listFiles('.', dir, 2);
    return files.slice(0, 60).join('\n');
  } catch {
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
    } catch {}
  }
  return parts.join('\n\n');
}

export function buildAutoContext(userQuery: string, projectDir: string): string {
  // Buscar archivos relevantes segun la consulta del usuario
  const terms = userQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return '';

  const seen = new Set<string>();
  const results: string[] = [];

  for (const term of terms.slice(0, 4)) {
    const matches = fastSearch(term, projectDir, '*.{ts,js,json,md,py}', 3);
    for (const m of matches) {
      if (!seen.has(m.file) && results.length < 5) {
        seen.add(m.file);
        try {
          const content = fileTools.readFile(m.file, projectDir).slice(0, 2000);
          results.push(`--- ${m.file} (autocontext) ---\n${content}`);
        } catch {}
      }
    }
  }
  return results.join('\n\n');
}
