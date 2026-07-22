// src/agents/commands.ts
// Manejador de comandos slash del orchestrator

import * as fs from 'fs';
import * as path from 'path';
import { ObsidianVault } from '../memory/vault';
import { SessionMemory } from '../memory/session';
import type { ConfigStore } from '../shared/config';
import { getAllModels } from '../llm/providers';

export interface CommandResult {
  response: string;
  action?: { type: string; command: string; cwd: string };
}

export async function handleCommand(
  command: string,
  vault: ObsidianVault,
  session: SessionMemory,
  config: ConfigStore,
  projectDir: string,
  currentModel: string,
  setModel: (m: string) => boolean,
  clearHistory: () => void,
): Promise<CommandResult> {
  const space = command.indexOf(' ');
  const cmd = space > 0 ? command.slice(1, space).toLowerCase() : command.slice(1).toLowerCase();
  const args = space > 0 ? command.slice(space + 1).trim() : '';

  switch (cmd) {
    case 'help': return { response: helpText() };
    case 'new': case 'clear':
      clearHistory(); session.clear();
      config.setChatHistory([]); config.resetTurnCount();
      return { response: 'Nueva conversacion iniciada.' };
    case 'history': {
      const h = config.chatHistory;
      if (h.length === 0) return { response: '(sin historial)' };
      return { response: 'Historial:\n' + h.slice(-20).map((m, i) =>
        `[${i + 1}] ${m.role.toUpperCase()}: ${(m.content || '').slice(0, 120)}`).join('\n') };
    }
    case 'models': {
      if (args) {
        if (setModel(args)) return { response: `Modelo: ${args}` };
        const models = getAllModels();
        const match = models.find(m => m.model.includes(args) || m.model.toLowerCase().includes(args.toLowerCase()));
        if (match) { setModel(match.model); return { response: `Modelo: ${match.model}` }; }
        return { response: `No encontrado: ${args}` };
      }
      return { response: listModels(currentModel) };
    }
    case 'model': {
      if (!args) return { response: `Modelo actual: ${currentModel}\nUsa /model <id> para cambiar o /models para ver lista.` };
      if (setModel(args)) return { response: `Modelo: ${args}` };
      const models = getAllModels();
      const match = models.find(m => m.model.includes(args) || m.model.toLowerCase().includes(args.toLowerCase()));
      if (match) { setModel(match.model); return { response: `Modelo: ${match.model}` }; }
      return { response: `No encontrado: ${args}. Usa /models para ver disponibles.` };
    }
    case 'health': {
      const { getHealthSummary } = await import('../llm/health');
      const h = getHealthSummary();
      return { response: `Health: ${h.healthy} healthy, ${h.unhealthy} down de ${h.total} total\nUltimo check: ${h.lastCheck || 'nunca'}` };
    }
    case 'test-models': case 'testmodels': {
      return { response: 'Testing todos los modelos...', action: { type: 'testModels', command: args, cwd: projectDir } };
    }
    case 'graph': {
      return { response: `Grafo de conocimiento:\n${vault.getGraph().nodes.length} nodos, ${vault.getGraph().edges.length} conexiones\nUsa /vault para ver notas.` };
    }
    case 'stats': case 'tokens': {
      return { response: `Tokens: ${config.stats.tokens.toLocaleString()} | Requests: ${config.stats.requests} | Turnos: ${config.stats.turns} | Historial: ${config.stats.history} msgs` };
    }
    case 'allow': {
      if (!args) return { response: 'Uso: /allow <comando> (ej: /allow python)' };
      const { addAllow } = await import('../tools/sandbox');
      addAllow(args);
      return { response: `Comando "${args}" agregado a la allowlist del sandbox.` };
    }
    case 'vault': {
      const notes = vault.listNotes();
      return { response: notes.length === 0 ? 'Vault vacio.' : 'Notas:\n' + notes.map(n => `  - [[${n.name}]]: ${n.excerpt}`).join('\n') };
    }
    case 'vault:search': {
      if (!args) return { response: 'Uso: /vault:search <terminos>' };
      const notes = vault.searchNotes(args);
      return { response: notes.length === 0 ? `Sin resultados: ${args}` : 'Resultados:\n' + notes.map(n => `  - [[${n.name}]]: ${n.excerpt}`).join('\n') };
    }
    case 'install': return detectInstallCommand(projectDir);
    case 'build': return detectBuildCommand(projectDir);
    case 'test': return detectTestCommand(projectDir);
    case 'index': return { response: 'Indexando proyecto en el grafo de conocimiento...', action: { type: 'index', command: '', cwd: projectDir } };
    case 'cd': {
      if (!args) return { response: `Directorio actual: ${projectDir}` };
      const target = path.resolve(projectDir, args);
      if (!fs.existsSync(target)) return { response: `No existe: ${target}` };
      if (!fs.statSync(target).isDirectory()) return { response: `No es un directorio: ${target}` };
      return { response: `Workspace cambiado a: ${target}`, action: { type: 'cd', command: target, cwd: target } };
    }
    case 'say': {
      if (!args) return { response: 'Uso: /say <texto>' };
      return { response: `Hablando...`, action: { type: 'say', command: args, cwd: projectDir } };
    }
    case 'voices': {
      const { listVoices } = await import('../tools/voice');
      const voices = await listVoices();
      return { response: 'Voces disponibles:\n' + voices.map(v => `  - ${v}`).join('\n') };
    }
    case 'voice-install': {
      const { installSpanishVoice } = await import('../tools/voice');
      const result = await installSpanishVoice();
      return { response: result };
    }
    case 'commit': {
      const msg = args || undefined;
      const { gitAutoCommit } = await import('../tools/git-workflow');
      const result = await gitAutoCommit(projectDir, msg);
      return { response: result };
    }
    case 'push': {
      const { autoCommitAndPush } = await import('../tools/git-workflow');
      const result = await autoCommitAndPush(projectDir, args || undefined);
      return { response: result };
    }
    case 'diff': {
      const { gitDiff } = await import('../tools/git-workflow');
      const result = await gitDiff(projectDir);
      return { response: result };
    }
    case 'log': {
      const { gitLog } = await import('../tools/git-workflow');
      const result = await gitLog(projectDir, args ? parseInt(args) : 5);
      return { response: result };
    }
    case 'resume': {
      return { response: `Sesion restaurada. ${config.stats.history} mensajes en historial.\nUsa /history para verlos.` };
    }
    case 'click': {
      const { mouseClick } = await import('../tools/automation');
      const btn = args || 'left';
      const r = await mouseClick(btn);
      return { response: r };
    }
    case 'type': {
      if (!args) return { response: 'Uso: /type <texto>' };
      const { keyboardType } = await import('../tools/automation');
      const r = await keyboardType(args);
      return { response: r };
    }
    case 'press': {
      if (!args) return { response: 'Uso: /press <teclas> (ej: /press ctrl+c)' };
      const { keyboardPress } = await import('../tools/automation');
      const r = await keyboardPress(args);
      return { response: r };
    }
    case 'screenshot': {
      const { screenCapture } = await import('../tools/automation');
      const cap = await screenCapture();
      return { response: cap ? `Screenshot: ${cap.path}` : 'Error' };
    }
    case 'mouse': {
      const { getMousePosition } = await import('../tools/automation');
      const pos = await getMousePosition();
      return { response: `Mouse en: (${pos.x}, ${pos.y})` };
    }
    case 'sandbox': {
      const { getSandboxConfig, setSandboxMode, allowAll } = await import('../tools/sandbox');
      if (args === 'allow-all') { allowAll(); return { response: 'Todos los comandos permitidos esta sesion.' }; }
      if (args === 'allow' || args === 'ask' || args === 'deny') { setSandboxMode(args); return { response: `Sandbox: ${args}` }; }
      const cfg = getSandboxConfig();
      return { response: `Sandbox: ${cfg.mode} | Allowlist: ${cfg.allowlist.length} comandos | Denylist: ${cfg.denylist.length} patrones` };
    }
    case 'logs': {
      const { getRecentLogs } = await import('../shared/logger');
      return { response: getRecentLogs(30) };
    }
    case 'init': {
      const knowledgePath = path.join(projectDir, 'knowledge.md');
      if (!fs.existsSync(knowledgePath)) {
        fs.writeFileSync(knowledgePath, `# ${path.basename(projectDir)} — Knowledge Base\n\n## Architecture\n\n## Key Files\n\n## Patterns\n\n## Dependencies\n\n## Notes\n`);
      }
      return { response: `Archivo creado: ${knowledgePath}` };
    }
    case 'browse': {
      if (!args) return { response: 'Uso: /browse <url>' };
      return { response: `Abriendo ${args}...`, action: { type: 'browse', command: args, cwd: projectDir } };
    }
    case 'open': {
      if (!args) return { response: 'Uso: /open <app>' };
      return { response: `Abriendo ${args}...`, action: { type: 'open', command: args, cwd: projectDir } };
    }
    case 'status': return { response: getStatus(config, vault, session, currentModel, projectDir) };
    case 'tokens': return { response: `Tokens: ${config.stats.tokens.toLocaleString()} | Requests: ${config.stats.requests} | Turnos: ${config.stats.turns}` };
    case 'exit': case 'quit': return { response: 'Hasta luego. Ctrl+C para salir.' };
    default: return { response: `Comando desconocido: ${command}. Usa /help.` };
  }
}

function detectInstallCommand(dir: string): CommandResult {
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    const hasBun = fs.existsSync(path.join(dir, 'bun.lock')) || fs.existsSync(path.join(dir, 'bun.lockb'));
    const cmd = hasBun ? 'bun install' : 'npm install';
    return { response: `Instalando dependencias (${hasBun ? 'bun' : 'npm'})...`, action: { type: 'exec', command: cmd, cwd: dir } };
  }
  if (fs.existsSync(path.join(dir, 'requirements.txt'))) {
    return { response: 'Instalando dependencias Python...', action: { type: 'exec', command: 'pip install -r requirements.txt', cwd: dir } };
  }
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    return { response: 'Compilando Rust...', action: { type: 'exec', command: 'cargo build', cwd: dir } };
  }
  if (fs.existsSync(path.join(dir, 'go.mod'))) {
    return { response: 'Descargando dependencias Go...', action: { type: 'exec', command: 'go mod download', cwd: dir } };
  }
  return { response: 'No se detecto package.json, requirements.txt, Cargo.toml ni go.mod.' };
}

function detectBuildCommand(dir: string): CommandResult {
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.build) return { response: 'Compilando (npm run build)...', action: { type: 'exec', command: 'npm run build', cwd: dir } };
      if (scripts.compile) return { response: 'Compilando (npm run compile)...', action: { type: 'exec', command: 'npm run compile', cwd: dir } };
    } catch { /* JSON parse fallback */ }
    return { response: 'Ejecutando tsc...', action: { type: 'exec', command: 'npx tsc --noEmit', cwd: dir } };
  }
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    return { response: 'Compilando Rust...', action: { type: 'exec', command: 'cargo build --release', cwd: dir } };
  }
  if (fs.existsSync(path.join(dir, 'Makefile'))) {
    return { response: 'Ejecutando make...', action: { type: 'exec', command: 'make', cwd: dir } };
  }
  return { response: 'No se detecto script de build.' };
}

function detectTestCommand(dir: string): CommandResult {
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.test) return { response: 'Ejecutando tests (npm test)...', action: { type: 'exec', command: 'npm test', cwd: dir } };
    } catch { /* JSON parse fallback */ }
  }
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    return { response: 'Ejecutando tests Rust...', action: { type: 'exec', command: 'cargo test', cwd: dir } };
  }
  return { response: 'No se detecto script de test.' };
}

function helpText(): string {
  return `ULTRON v5 — Comandos:
  /help            - Esta ayuda
  /new /clear      - Nueva conversacion (limpiar historial)
  /history         - Historial reciente
  /model <id>      - Cambiar modelo de IA
  /models          - Listar todos los modelos disponibles
  /test-models     - Testear todos los modelos y mostrar solo accesibles
  /health          - Estado de salud de los modelos
  /stats /tokens   - Estadisticas de uso
  /vault           - Notas en vault
  /vault:search <q>- Buscar notas en memoria
  /graph           - Grafo de conocimiento
  /install         - Instalar dependencias (npm/pip/cargo/go)
  /build           - Compilar proyecto
  /test            - Ejecutar tests
  /index           - Indexar proyecto en grafo
  /init            - Crear knowledge.md en el proyecto
  /browse <url>    - Abrir URL en navegador
  /open <app>      - Abrir app (code, notepad, explorer)
  /sandbox <mode>  - Modo sandbox (ask/allow/deny/allow-all)
  /allow <cmd>     - Agregar comando a allowlist
  /click /type /press - Automatizacion mouse/teclado
  /screenshot      - Capturar pantalla
  /mouse           - Posicion del mouse
  /say <texto>     - Hablar por voz
  /voices          - Listar voces disponibles
  /voice-install   - Instalar voces en espanol
  /cd <dir>        - Cambiar directorio de trabajo
  /commit [msg]    - Auto-commit en git
  /push [msg]      - Auto-commit + push
  /diff            - Git diff
  /log [n]         - Git log (n commits)
  /resume          - Restaurar sesion
  /logs            - Ver logs recientes
  /status          - Estado del sistema
  /exit            - Salir

Atajos:
  !comando         - Ejecuta comando directo (!git status)
  @nombre_archivo  - Referencia archivo del proyecto
  @Agente          - Invoca agente (@Editor, @Librarian, ...)`;
}

function listModels(current: string): string {
  const models = getAllModels();
  const grouped: Record<string, string[]> = {};
  for (const m of models) { if (!grouped[m.provider]) grouped[m.provider] = []; grouped[m.provider].push(m.model); }
  const lines = [`Modelos disponibles. Actual: ${current}\n`];
  for (const [provider, providerModels] of Object.entries(grouped)) {
    lines.push(`  ${provider}:`);
    for (const m of providerModels) lines.push(`   ${m === current ? '*' : ' '} ${m}`);
  }
  return lines.join('\n');
}

function getStatus(
  config: ConfigStore, vault: ObsidianVault, session: SessionMemory,
  currentModel: string, projectDir: string,
): string {
  const stats = config.stats;
  return [
    `ULTRON v5.0.0`,
    `Modelo: ${currentModel}`,
    `Tokens: ${stats.tokens.toLocaleString()} | Requests: ${stats.requests} | Turnos: ${stats.turns}`,
    `Vault: ${vault.listNotes().length} notas | Historial: ${stats.history} msgs`,
    `Proyecto: ${projectDir}`,
  ].join('\n');
}

export function isSlashCommand(input: string): boolean {
  return input.startsWith('/') || input.startsWith('!');
}
