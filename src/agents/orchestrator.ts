// src/agents/orchestrator.ts - v3: conversacion limpia, sin tool_calls en historial
import * as path from 'path';
import type { ChatMessage, ToolDefinition } from '../shared/types';
import type { AgentEvent, OrchestratorConfig } from './types';
import { chatCompletion } from '../llm/chat';
import { getProviders, getAllModels, getHealthyModelList } from '../llm/providers';
import { isModelHealthy, setHealthFile } from '../llm/health';
import { ConfigStore } from '../shared/config';
import { ObsidianVault } from '../memory/vault';
import { SessionMemory } from '../memory/session';
import { EditorAgent } from './editor';
import { LibrarianAgent } from './librarian';
import { BasherAgent } from './basher';
import { ResearcherAgent } from './researcher';
import { ThinkerAgent } from './thinker';
import { ReviewerAgent } from './reviewer';
import { ArchitectAgent } from './architect';
import { GraphLearner } from './graph-learner';
import { buildSystemPrompt, buildSummarizePrompt } from './prompts';
import { executeTool, executeToolsParallel } from './tools-executor';
import { handleCommand, isSlashCommand } from './commands';
import * as fileTools from '../tools/file';
import { executeCommand } from '../tools/execute';
import { sandboxedExec, getSandboxConfig, setSandboxMode, allowAll, addAllow } from '../tools/sandbox';
import { log } from '../shared/logger';

const SUMMARIZE_EVERY = 12;

function toolLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'delegate_editor': return `editando (Artífice)`;
    case 'delegate_librarian': return `analizando codebase (Sabio)`;
    case 'delegate_basher': return `ejecutando (Ejecutor)`;
    case 'delegate_researcher': return `buscando web (Explorador)`;
    case 'delegate_thinker': return `planificando (Estratega)`;
    case 'delegate_reviewer': return `revisando (Juez)`;
    case 'read_file': return `leyendo ${(args.filePath as string || '').split('/').pop()}`;
    case 'write_file': return `escribiendo ${(args.filePath as string || '').split('/').pop()}`;
    case 'str_replace': return `editando ${(args.filePath as string || '').split('/').pop()}`;
    case 'grep': return `buscando`;
    case 'direct_execute': return (args.command as string || '').slice(0, 30);
    default: return name.replace('delegate_', '').replace('direct_', '');
  }
}

const DISPLAY_NAMES: Record<string, string> = {
  Orchestrator: 'Cerebro',
  Architect: 'Visión',
  Editor: 'Artífice',
  Librarian: 'Sabio',
  Basher: 'Ejecutor',
  Researcher: 'Explorador',
  Thinker: 'Estratega',
  Reviewer: 'Juez',
};

function displayName(name: string): string {
  return DISPLAY_NAMES[name] || name;
}

function agentForTool(name: string): string {
  if (name.startsWith('delegate_')) return name.replace('delegate_', '').replace(/^\w/, c => c.toUpperCase());
  if (name.includes('file') || name === 'grep' || name === 'str_replace') return 'Editor';
  if (name.includes('execute')) return 'Basher';
  if (name.includes('search')) return 'Researcher';
  return 'Orchestrator';
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private vault: ObsidianVault;
  private session: SessionMemory;
  private configStore: ConfigStore;
  private conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private editor: EditorAgent;
  private librarian: LibrarianAgent;
  private basher: BasherAgent;
  private researcher: ResearcherAgent;
  private thinker: ThinkerAgent;
  private reviewer: ReviewerAgent;
  private architect: ArchitectAgent;
  private graphLearner: GraphLearner;
  private onEvent?: (event: AgentEvent) => void;
  private onStream?: (text: string) => void;
  private currentModel: string;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.vault = new ObsidianVault(config.vaultDir);
    setHealthFile(path.join(config.vaultDir, 'model-health.json'));
    this.session = new SessionMemory({ maxEvents: 500 });
    this.configStore = new ConfigStore(config.vaultDir);
    this.editor = new EditorAgent(config.projectDir);
    this.librarian = new LibrarianAgent(config.projectDir);
    this.basher = new BasherAgent(config.projectDir);
    this.researcher = new ResearcherAgent();
    this.thinker = new ThinkerAgent();
    this.reviewer = new ReviewerAgent();
    this.architect = new ArchitectAgent();
    this.graphLearner = new GraphLearner(this.vault, config.projectDir);

    const saved = this.configStore.currentModel;
    this.currentModel = (saved && isModelHealthy(saved)) ? saved
      : getHealthyModelList()[0]?.model || getProviders()[0]?.defaultModel || 'deepseek-chat';

    this.conversation = (this.configStore.chatHistory || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: (m.content || '').slice(0, 2000) }))
      .slice(-6);

    this.vaultInit();
    log.info('Orchestrator initialized', { model: this.currentModel, projectDir: config.projectDir, historyMsgs: this.conversation.length });
  }

  private lastListenerId = 0;
  private listeners: Map<string, { onEvent: (event: AgentEvent) => void; onStream: (text: string) => void }> = new Map();

  setEventEmitter(cb: (event: AgentEvent) => void): void { this.onEvent = cb; }
  setStreamCallback(cb: (text: string) => void): void { this.onStream = cb; }
  addListener(l: { onEvent: (event: AgentEvent) => void; onStream: (text: string) => void }): string {
    const id = `L${++this.lastListenerId}`;
    this.listeners.set(id, l);
    return id;
  }
  removeListener(id: string): void { this.listeners.delete(id); }
  getCurrentModel(): string { return this.currentModel; }
  setCurrentModel(modelId: string): boolean {
    if (getAllModels().some(m => m.model === modelId)) {
      this.currentModel = modelId; this.configStore.setCurrentModel(modelId); return true;
    } return false;
  }
  getStats() { return this.configStore.stats; }
  private emit(e: AgentEvent): void {
    this.onEvent?.(e);
    for (const l of this.listeners.values()) l.onEvent(e);
  }
  private stream(t: string): void {
    this.onStream?.(t);
    for (const l of this.listeners.values()) l.onStream(t);
  }

  private vaultInit(): void {
    if (!this.vault.readNote('capacidades_ultron'))
      this.vault.autoSave('system', '# ULTRON v5\nNeural Intelligence Platform.');
    if (!this.vault.readNote('perfil_usuario'))
      this.vault.autoSave('context', 'Nombre: (por definir)\nIdioma: espanol\nSistema: Windows');
  }

  private async openURL(url: string): Promise<void> {
    await executeCommand(process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`, this.config.projectDir);
  }
  private async openApp(app: string): Promise<void> {
    await executeCommand(process.platform === 'win32' ? `start "" "${app}"` : `open "${app}"`, this.config.projectDir);
  }

  async handleMessage(userMessage: string): Promise<string> {
    const input = this.preprocess(userMessage);

    if (isSlashCommand(userMessage)) {
      const r = await handleCommand(userMessage, this.vault, this.session, this.configStore,
        this.config.projectDir, this.currentModel,
        m => this.setCurrentModel(m), () => { this.conversation = []; });
      if (r.action) {
        const { type, command, cwd } = r.action;
        if (type === 'browse') { await this.openURL(command); return r.response; }
        if (type === 'open') { await this.openApp(command); return r.response; }
        if (type === 'say') { const { speak } = await import('../tools/voice'); return speak(command); }
        if (type === 'index') { const g = await this.graphLearner.indexProject(); return `${g.nodes} nodos, ${g.files} archivos.`; }
        if (type === 'cd') { this.config.projectDir = command; return `Workspace: ${command}`; }
        if (type === 'testModels') {
          const { testAllModels } = await import('./model-tester');
          this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: 'Testeando modelos...', data: {} });
          testAllModels(this.currentModel, (result) => {
            this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: `${result.model.split('/').pop()}: ${result.ok ? '✓' : '✗'} (${result.ms}ms)`, data: result });
          }).then(summary => {
            this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: summary.slice(0, 120), data: { done: true } });
            this.emit({ type: 'done', agent: 'Orchestrator', displayName: 'Cerebro', message: '' });
          }).catch(() => {});
          return 'Testeando modelos... Los resultados se mostrarán en el panel de Agentes.';
        }
        const out = await sandboxedExec(command, cwd);
        return r.response + '\n\n' + out.slice(0, 2000);
      }
      return r.response;
    }

    this.emit({ type: 'thought', agent: 'Orchestrator', displayName: 'Cerebro', message: '' });

    const sp = buildSystemPrompt(this.vault, this.session, this.configStore, this.config.projectDir, '').slice(0, 5000);
    this.stream('');
    const msgs: ChatMessage[] = [{ role: 'system', content: sp }, ...this.conversation.slice(-6), { role: 'user', content: input }];
    const tools = this.getTools();
    let out = ''; let t = 0;

    while (t < this.config.maxSteps) {
      t++;
      try {
        const resp = await chatCompletion(
          { model: this.currentModel, messages: msgs, tools, tool_choice: 'auto', temperature: 0.7 },
          c => { if (c.content) this.stream(c.content); },
          ev => { this.currentModel = ev.to; },
        );
        if (resp.usage) this.configStore.addTokens(resp.usage.prompt_tokens, resp.usage.completion_tokens);

        if (resp.tool_calls?.length) {
          msgs.push({ role: 'assistant', content: resp.content, tool_calls: resp.tool_calls });
          const results = await executeToolsParallel(resp.tool_calls, (n, a) => this.runTool(n, a));
          for (const r of results) msgs.push({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content });
        } else { out = resp.content || 'OK'; break; }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.currentModel = getProviders()[0]?.defaultModel || 'deepseek-chat';
        this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: `Error: ${msg}`, data: { error: msg } });
        out = `[Error] ${msg}`;
        break;
      }
    }

    if (!out) out = 'Max steps.';

    this.conversation.push({ role: 'user', content: input }, { role: 'assistant', content: out });
    if (this.conversation.length > 20) this.conversation = this.conversation.slice(-20);
    this.configStore.setChatHistory(this.conversation);

    log.chat('message processed', { tokens: this.configStore.stats.tokens, model: this.currentModel, inputLen: input.length, outputLen: out.length });

    this.vault.autoSave('context', `User: ${input.slice(0, 200)}\n\nULTRON: ${out.slice(0, 500)}`);
    this.session.record('chat', input.slice(0, 100), out.slice(0, 200));
    if (this.configStore.turnCount > 0 && this.configStore.turnCount % SUMMARIZE_EVERY === 0) this.autoSummary();

    this.emit({ type: 'done', agent: 'Orchestrator', displayName: 'Cerebro', message: '' });
    return out;
  }

  private preprocess(input: string): string {
    const files: string[] = [];
    const re = /@([\w./\\-]+(?:\.[a-zA-Z0-9]+)?)/g; let m;
    while ((m = re.exec(input)) !== null) {
      if (!['Editor','Librarian','Basher','Researcher','Thinker','Reviewer','Cerebro','Visión','Artífice','Sabio','Ejecutor','Explorador','Estratega','Juez'].includes(m[1])) files.push(m[1]);
    }
    let msg = input;
    for (const f of files) {
      try { const content = fileTools.readFile(f, this.config.projectDir); msg += `\n[@${f}]:\n` + content.slice(0, 1500); } catch {}
    }
    return msg;
  }

  private async runTool(name: string, args: Record<string, unknown>): Promise<{ result: string; retries: number }> {
    const toolAgent = agentForTool(name);
    this.emit({ type: 'action', agent: toolAgent, displayName: displayName(toolAgent), message: toolLabel(name, args), data: args });
    log.tool(name, args, 'executing');
    const { result, retries } = await executeTool(name, args, this.config.projectDir, this.editor, this.librarian, this.basher, this.researcher, this.thinker, this.reviewer, this.architect);
    if (name === 'vault_save') this.vault.writeNote(args.name as string, args.content as string);
    log.tool(name, args, result.slice(0, 200));
    return { result, retries };
  }

  private async autoSummary(): Promise<void> {
    try {
      const recent = this.conversation.slice(-6);
      const text = recent.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
      const r = await chatCompletion({ model: 'deepseek-chat', messages: [{ role: 'user', content: buildSummarizePrompt(text) }], temperature: 0.3, max_tokens: 200 });
      const j = r.content?.match(/\{[\s\S]*\}/);
      if (j) { const p = JSON.parse(j[0]); if (p.summary) this.vault.autoSave('context', `[summary]\n${p.summary}`); }
    } catch {}
  }

  private getTools(): ToolDefinition[] {
    const d = (name: string, desc: string, props: Record<string, unknown> = {}, required: string[] = []): ToolDefinition =>
      ({ type: 'function', function: { name, description: desc, parameters: { type: 'object', properties: props, required } } });
    return [
      d('delegate_editor', 'Artífice: lee/modifica archivos', { task: { type: 'string' } }, ['task']),
      d('delegate_librarian', 'Sabio: analiza codebase', { task: { type: 'string' } }, ['task']),
      d('delegate_basher', 'Ejecutor: ejecuta comandos', { task: { type: 'string' } }, ['task']),
      d('delegate_researcher', 'Explorador: busca en web', { task: { type: 'string' } }, ['task']),
      d('delegate_thinker', 'Estratega: planifica tareas', { task: { type: 'string' } }, ['task']),
      d('delegate_reviewer', 'Juez: revisa codigo', { content: { type: 'string' }, context: { type: 'string' } }, ['content']),
      d('delegate_architect', 'Visión: planifica proyectos grandes con fases y pasos', { task: { type: 'string' } }, ['task']),
      d('vault_save', 'Guarda nota en vault', { name: { type: 'string' }, content: { type: 'string' } }, ['name', 'content']),
      d('direct_execute', 'Ejecuta comando', { command: { type: 'string' } }, ['command']),
      d('direct_search', 'Busca en web', { query: { type: 'string' } }, ['query']),
      d('read_file', 'Lee archivo', { filePath: { type: 'string' } }, ['filePath']),
      d('write_file', 'Crea/sobrescribe archivo', { filePath: { type: 'string' }, content: { type: 'string' } }, ['filePath', 'content']),
      d('grep', 'Busca texto en archivos', { query: { type: 'string' }, filePattern: { type: 'string' } }, ['query']),
      d('str_replace', 'Reemplaza texto en archivo', { filePath: { type: 'string' }, old_str: { type: 'string' }, new_str: { type: 'string' } }, ['filePath', 'old_str', 'new_str']),
      d('browse_url', 'Abre URL en navegador', { url: { type: 'string' } }, ['url']),
      d('open_app', 'Abre aplicacion', { app: { type: 'string' } }, ['app']),
      d('analyze_document', 'Analiza documento (PDF, DOCX, XLSX)', { filePath: { type: 'string' } }, ['filePath']),
      d('run_lint', 'Ejecuta typecheck/lint', {}, []),
      d('speak', 'Habla texto en voz alta', { text: { type: 'string' }, voice: { type: 'string' } }, ['text']),
      d('mouse_click', 'Hace click del mouse (left/right)', { button: { type: 'string' } }, []),
      d('mouse_move', 'Mueve el mouse a coordenadas (x,y)', { x: { type: 'number' }, y: { type: 'number' } }, ['x', 'y']),
      d('keyboard_type', 'Escribe texto con el teclado', { text: { type: 'string' } }, ['text']),
      d('keyboard_press', 'Presiona combinacion de teclas (ej: ctrl+c, alt+tab)', { keys: { type: 'string' } }, ['keys']),
      d('screen_capture', 'Toma una captura de pantalla', {}, []),
      d('screen_info', 'Info de pantalla: resolucion y ventanas activas', {}, []),
      d('smart_click', 'Click inteligente multi-estrategia con fallback', { target: { type: 'string' } }, ['target']),
      d('smart_type', 'Escribe texto inteligentemente (limpia campo primero)', { text: { type: 'string' }, field: { type: 'string' } }, ['text']),
      d('open_focus', 'Abre y enfoca una app (multi-estrategia: Win+R, Start)', { app: { type: 'string' } }, ['app']),
      d('queue_status', 'Estado de la cola de tareas en background', {}, []),
      d('run_task', 'Ejecuta tarea multi-paso con auto-retry (3 intentos por paso)', { description: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } }, ['description', 'steps']),
      d('save_desktop', 'Guarda un archivo directamente en el Escritorio y verifica que existe', { filename: { type: 'string' }, content: { type: 'string' } }, ['filename', 'content']),
      d('save_file', 'Guarda un archivo en una ruta especifica y verifica', { path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']),
      d('check_file', 'Verifica si un archivo existe y muestra su contenido', { path: { type: 'string' } }, ['path']),
      d('desktop_path', 'Devuelve la ruta del Escritorio', {}, []),
    ];
  }
}
