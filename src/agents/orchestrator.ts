// src/agents/orchestrator.ts - v3: conversacion limpia, sin tool_calls en historial
import * as path from 'path';
import type { ChatMessage, ToolDefinition } from '../shared/types';
import type { AgentEvent, OrchestratorConfig } from './types';
import { chatCompletion } from '../llm/chat';
import { getProviders, getAllModels, getHealthyModelList } from '../llm/providers';
import { isModelHealthy, setHealthFile } from '../llm/health';
import { ConfigStore } from '../shared/config';
import { UltronConfigStore } from '../shared/ultron-config';
import { ObsidianVault } from '../memory/vault';
import { SessionMemory } from '../memory/session';
import { SessionManager } from '../memory/session-manager';
import { EditorAgent } from './editor';
import { LibrarianAgent } from './librarian';
import { BasherAgent } from './basher';
import { ResearcherAgent } from './researcher';
import { ThinkerAgent } from './thinker';
import { ReviewerAgent } from './reviewer';
import { ArchitectAgent } from './architect';
import { GraphLearner } from './graph-learner';
import { GraphMemoryBridge } from '../graph-memory/bridge';
import { MCPServer } from '../mcp/server';
import { StdioTransport } from '../mcp/stdio';
import { SkillsLoader } from '../skills/loader';
import { FileWatcher } from '../watcher/index';
import { buildSystemPrompt, buildSummarizePrompt } from './prompts';
import { executeTool, executeToolsParallel } from './tools-executor';
import { handleCommand, isSlashCommand } from './commands';
import * as fileTools from '../tools/file';
import { executeCommand } from '../tools/execute';
import { sandboxedExec, getSandboxConfig, setSandboxMode, allowAll, addAllow } from '../tools/sandbox';
import { filterPrivateInfo } from '../memory/privacy';
import { SharedContext } from '../memory/shared-context';
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
  private sessionManager: SessionManager;
  private configStore: ConfigStore;
  private ultronConfig: UltronConfigStore;
  private conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private editor: EditorAgent;
  private librarian: LibrarianAgent;
  private basher: BasherAgent;
  private researcher: ResearcherAgent;
  private thinker: ThinkerAgent;
  private reviewer: ReviewerAgent;
  private architect: ArchitectAgent;
  private graphLearner: GraphLearner;
  private graphMemory: GraphMemoryBridge;
  private mcpServer: MCPServer;
  private mcpTransport: StdioTransport | null = null;
  private skillsLoader: SkillsLoader;
  private fileWatcher: FileWatcher | null = null;
  private onEvent?: (event: AgentEvent) => void;
  private onStream?: (text: string) => void;
  private currentModel: string;
  private agentModels: Map<string, string> = new Map();
  private agentStates: Map<string, { status: string; message: string; history: Array<{ time: string; text: string }>; lastActive: number }> = new Map();
  private activeController: AbortController | null = null;
  private sharedContext: Map<string, unknown> = new Map();
  private ctx: SharedContext;

  setAgentModel(agentName: string, modelId: string): void {
    this.agentModels.set(agentName.toLowerCase(), modelId);
  }

  getModelForAgent(agentName: string): string {
    return this.agentModels.get(agentName.toLowerCase()) || this.currentModel;
  }

  cancel(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  private updateAgentState(agent: string, status: string, message: string): void {
    const state = this.agentStates.get(agent) || { status: 'idle', message: '', history: [], lastActive: 0 };
    state.status = status;
    state.message = message;
    state.lastActive = Date.now();
    if (status === 'action' || status === 'thought') {
      const text = message || (status === 'thought' ? 'pensando...' : '');
      if (text) state.history.push({ time: new Date().toLocaleTimeString(), text });
      if (state.history.length > 20) state.history = state.history.slice(-20);
    }
    this.agentStates.set(agent, state);
  }

  cleanupAgentStates(): void {
    const now = Date.now();
    for (const [agent, state] of this.agentStates) {
      if ((state.status === 'done' || state.status === 'idle') && now - state.lastActive > 10000) {
        state.message = '';
      }
    }
  }

  getAgentStates(): Array<{ id: string; status: string; message: string; history: Array<{ time: string; text: string }> }> {
    const states: Array<{ id: string; status: string; message: string; history: Array<{ time: string; text: string }> }> = [];
    for (const [id, state] of this.agentStates) {
      states.push({ id, status: state.status, message: state.message, history: state.history });
    }
    return states;
  }

  async executeToolDirectly(name: string, args: Record<string, unknown>): Promise<{ result: string; retries: number }> {
    return this.runTool(name, args);
  }

  getGraphMemory(): GraphMemoryBridge { return this.graphMemory; }
  getMCPServer(): MCPServer { return this.mcpServer; }
  getSkillsLoader(): SkillsLoader { return this.skillsLoader; }
  getUltronConfig(): UltronConfigStore { return this.ultronConfig; }
  getSessionManager(): SessionManager { return this.sessionManager; }
  getSharedContext(): SharedContext { return this.ctx; }
  getProjectDir(): string { return this.config.projectDir; }
  setProjectDir(dir: string): void {
    this.config.projectDir = dir;
    this.editor = new EditorAgent(dir);
    this.librarian = new LibrarianAgent(dir);
    this.basher = new BasherAgent(dir);
    this.graphLearner = new GraphLearner(this.vault, dir);
    log.info('Project dir changed', { dir });
  }

  saveCurrentConversation(): void {
    const activeId = this.sessionManager.getActiveId();
    this.sessionManager.saveConversation(activeId, this.conversation);
  }

  loadConversationForSession(sessionId: string): void {
    const conv = this.sessionManager.getConversation(sessionId);
    this.conversation = conv;
  }

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.vault = new ObsidianVault(config.vaultDir);
    setHealthFile(path.join(config.vaultDir, 'model-health.json'));
    this.session = new SessionMemory({ maxEvents: 500 });
    this.configStore = new ConfigStore(config.vaultDir);
    this.ultronConfig = new UltronConfigStore(config.projectDir, config.vaultDir);
    this.sessionManager = new SessionManager(config.vaultDir);
    this.session = this.sessionManager.getActive();
    this.editor = new EditorAgent(config.projectDir);
    this.librarian = new LibrarianAgent(config.projectDir);
    this.basher = new BasherAgent(config.projectDir);
    this.researcher = new ResearcherAgent();
    this.thinker = new ThinkerAgent();
    this.reviewer = new ReviewerAgent();
    this.architect = new ArchitectAgent();
    this.graphLearner = new GraphLearner(this.vault, config.projectDir);
    this.graphMemory = new GraphMemoryBridge(config.projectDir);
    this.mcpServer = new MCPServer(this);
    this.skillsLoader = new SkillsLoader(this.ultronConfig.getSkills().dirs);
    this.ctx = new SharedContext(this.sessionManager.getActiveId());

    // Connect sub-agent event emitters to forward events
    const forwardEvent = (event: AgentEvent) => {
      this.emit(event);
    };
    this.editor.setEventEmitter(forwardEvent);
    this.librarian.setEventEmitter(forwardEvent);
    this.basher.setEventEmitter(forwardEvent);
    this.researcher.setEventEmitter(forwardEvent);
    this.thinker.setEventEmitter(forwardEvent);
    this.reviewer.setEventEmitter(forwardEvent);

    this.initSubsystems();

    // Per-agent model overrides from env: ULTRON_MODEL_EDITOR=qwen-coder-plus
    for (const [k, v] of Object.entries(process.env)) {
      if (v && k.startsWith('ULTRON_MODEL_')) {
        const agent = k.replace('ULTRON_MODEL_', '').toLowerCase();
        this.agentModels.set(agent, v);
      }
    }

    // Apply ultron.json agent model overrides
    const cfgAgentModels = this.ultronConfig.getModels().agentModels;
    for (const [agent, model] of Object.entries(cfgAgentModels)) {
      this.agentModels.set(agent.toLowerCase(), model);
    }

    const saved = this.configStore.currentModel;
    this.currentModel = (saved && isModelHealthy(saved)) ? saved
      : getHealthyModelList()[0]?.model || getProviders()[0]?.defaultModel || 'deepseek-chat';

    this.conversation = this.sessionManager.getConversation(this.sessionManager.getActiveId())
      || (this.configStore.chatHistory || [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: (m.content || '').slice(0, 2000) }))
        .slice(-6);
    // Set session model if available
    const sessModel = this.sessionManager.getSessionModel(this.sessionManager.getActiveId());
    if (sessModel && getAllModels().some(m => m.model === sessModel)) {
      this.currentModel = sessModel;
    }

    this.vaultInit();
    log.info('Orchestrator initialized', { model: this.currentModel, projectDir: config.projectDir, historyMsgs: this.conversation.length });
  }

  private async initSubsystems(): Promise<void> {
    this.startMemoryWatchdog();
    const mcpCfg = this.ultronConfig.getMCP();
    const skillsCfg = this.ultronConfig.getSkills();
    const watcherCfg = this.ultronConfig.getWatcher();

    if (this.ultronConfig.getMemory().graphMemory) {
      const ok = await this.graphMemory.init();
      if (ok) log.info('GraphMemoryBridge active');
      else log.warn('GraphMemoryBridge not available (code-graph-memory not installed)');
    }

    if (mcpCfg.enabled) {
      await this.mcpServer.init();
      this.mcpServer.registerToolsFromDefinitions(this.getTools());
      if (mcpCfg.serverMode === 'stdio' || mcpCfg.serverMode === 'both') {
        this.mcpTransport = new StdioTransport(this.mcpServer);
      }
      log.info('MCP Server initialized', { mode: mcpCfg.serverMode });
    }

    if (skillsCfg.enabled) {
      const count = await this.skillsLoader.loadAll();
      if (count > 0) log.info('Skills loaded', { count });
    }

    if (watcherCfg.enabled) {
      this.fileWatcher = new FileWatcher({
        watchDirs: watcherCfg.watchDirs,
        watchExtensions: watcherCfg.watchExtensions,
        debounceMs: watcherCfg.debounceMs,
        onFileChange: (event, filePath) => {
          this.emit({
            type: 'action',
            agent: 'Orchestrator',
            displayName: 'Cerebro',
            message: `Archivo ${event === 'add' ? 'añadido' : event === 'change' ? 'modificado' : 'eliminado'}: ${filePath}`,
            data: { event, file: filePath },
          });
        },
      });
      this.fileWatcher.start();
    }
  }

  private lastListenerId = 0;
  private listeners: Map<string, { onEvent: (event: AgentEvent) => void; onStream: (text: string) => void }> = new Map();
  private memTimer: ReturnType<typeof setInterval> | null = null;

  setEventEmitter(cb: (event: AgentEvent) => void): void { this.onEvent = cb; }
  setStreamCallback(cb: (text: string) => void): void { this.onStream = cb; }
  addListener(l: { onEvent: (event: AgentEvent) => void; onStream: (text: string) => void }): string {
    const id = `L${++this.lastListenerId}`;
    this.listeners.set(id, l);
    return id;
  }
  removeListener(id: string): void { this.listeners.delete(id); }

  private startMemoryWatchdog(): void {
    if (this.memTimer) return;
    this.memTimer = setInterval(() => {
      const mem = process.memoryUsage();
      if (mem.heapUsed > 500 * 1024 * 1024) {
        log.warn('High memory detected', { heapMB: Math.round(mem.heapUsed / 1024 / 1024) });
        // Trim conversation
        if (this.conversation.length > 6) this.conversation = this.conversation.slice(-6);
        // Clean stale listeners
        if (this.listeners.size > 10) this.listeners.clear();
        // Force GC hint
        global.gc?.();
      }
    }, 60000);
  }
  getCurrentModel(): string { return this.currentModel; }
  setCurrentModel(modelId: string): boolean {
    if (getAllModels().some(m => m.model === modelId)) {
      this.currentModel = modelId; this.configStore.setCurrentModel(modelId); return true;
    } return false;
  }
  getStats() { return this.configStore.stats; }
  private emit(e: AgentEvent): void {
    this.updateAgentState(e.agent, e.type, e.message);
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
          }).catch((e: unknown) => { log.warn('model tester failed', { error: e instanceof Error ? e.message : String(e) }); });
          return 'Testeando modelos... Los resultados se mostrarán en el panel de Agentes.';
        }
        const out = await sandboxedExec(command, cwd);
        return r.response + '\n\n' + out.slice(0, 2000);
      }
      return r.response;
    }

    this.cancel();
    this.activeController = new AbortController();

    this.emit({ type: 'thought', agent: 'Orchestrator', displayName: 'Cerebro', message: '' });

    let graphCtx = this.graphLearner.buildGraphContext(input);

    // Try graph memory bridge if available
    if (this.graphMemory.isAvailable()) {
      const cgmCtx = await this.graphMemory.search(input, undefined, 5);
      if (cgmCtx.length > 0) {
        graphCtx = `Grafo de conocimiento (code-graph-memory):\n${cgmCtx.map((r: any) => r.text).join('\n')}`;
      }
    }

    const skillsCtx = this.skillsLoader.getSystemPrompt();
    const sharedCtx = this.ctx.toPromptContext();
    const combinedCtx = skillsCtx + '\n\n' + sharedCtx;
    const sp = buildSystemPrompt(this.vault, this.session, this.configStore, this.config.projectDir, graphCtx, combinedCtx).slice(0, 5000);
    this.stream('');
    const msgs: ChatMessage[] = [{ role: 'system', content: sp }, ...this.conversation.slice(-6), { role: 'user', content: input }];
    const tools = this.getTools();
    let out = ''; let t = 0;

    while (t < this.config.maxSteps) {
      if (this.activeController?.signal.aborted) { out = '[Cancelado]'; break; }
      t++;
      try {
        let streamBuf = '';
        const resp = await chatCompletion(
          { model: this.currentModel, messages: msgs, tools, tool_choice: 'auto', temperature: 0.7 },
          c => {
            if (!c.content) return;
            streamBuf += c.content;
            if (streamBuf.length > 50000) streamBuf = streamBuf.slice(-50000);
            if (!looksLikeFunctionCallStart(streamBuf)) this.stream(c.content);
          },
          ev => { this.currentModel = ev.to; },
        );
        if (resp.usage) this.configStore.addTokens(resp.usage.prompt_tokens, resp.usage.completion_tokens);

        const tcs = resp.tool_calls?.length ? resp.tool_calls : tryParseTextToolCalls(resp.content);
        if (tcs?.length) {
          msgs.push({ role: 'assistant', content: resp.content?.slice(0, 2000) || null, tool_calls: tcs });
          const results = await executeToolsParallel(tcs, (n, a) => this.runTool(n, a));
          for (const r of results) {
            const truncated = r.content.length > 1500 ? r.content.slice(0, 1500) + '...[truncated]' : r.content;
            msgs.push({ role: 'tool', tool_call_id: r.tool_call_id, content: truncated });
          }
          // Keep msgs from growing too large — remove older messages if > 20
          if (msgs.length > 20) {
            const keep = msgs.filter(m => m.role === 'system');
            keep.push(...msgs.slice(-20));
            msgs.length = 0;
            msgs.push(...keep.slice(0, 30));
          }
        } else { out = resp.content || 'OK'; break; }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Try fallback model
        const fallbackModels = getHealthyModelList().map(m => m.model).filter(m => m !== this.currentModel);
        const fallback = fallbackModels[0] || getProviders()[0]?.defaultModel || 'deepseek-chat';
        this.currentModel = fallback;
        this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: `Modelo falló, cambiando a: ${fallback}`, data: { error: msg, fallback } });
        // One more try with fallback
        try {
          const resp = await chatCompletion({ model: this.currentModel, messages: msgs, tools, tool_choice: 'auto', temperature: 0.7 },
            c => { if (c.content) this.stream(c.content); }, ev => { this.currentModel = ev.to; });
          const tcs = resp.tool_calls?.length ? resp.tool_calls : tryParseTextToolCalls(resp.content);
          if (tcs?.length) {
            msgs.push({ role: 'assistant', content: resp.content, tool_calls: tcs });
            const results = await executeToolsParallel(tcs, (n, a) => this.runTool(n, a));
            for (const r of results) msgs.push({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content.slice(0, 1500) });
          } else { out = resp.content || 'OK'; break; }
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          this.emit({ type: 'action', agent: 'Orchestrator', displayName: 'Cerebro', message: `Error: ${msg2}`, data: { error: msg2 } });
          out = `[Error] ${msg2}\n\nUsa /model deepseek-chat o /model qwen-plus para cambiar de modelo.`;
          break;
        }
      }
    }

    if (!out) out = 'Max steps.';

    const userMsg = input.length > 2000 ? input.slice(0, 2000) : input;
    const asstMsg = out.length > 3000 ? out.slice(0, 3000) + '...[truncated]' : out;
    this.conversation.push({ role: 'user', content: userMsg }, { role: 'assistant', content: asstMsg });
    if (this.conversation.length > 10) this.conversation = this.conversation.slice(-10);
    this.configStore.setChatHistory(this.conversation);

    this.sessionManager.saveConversation(this.sessionManager.getActiveId(), this.conversation);
    this.sessionManager.recordMessage(this.sessionManager.getActiveId(), 'user', input);
    this.sessionManager.recordMessage(this.sessionManager.getActiveId(), 'assistant', out);

    log.chat('message processed', { tokens: this.configStore.stats.tokens, model: this.currentModel, inputLen: input.length, outputLen: out.length });

    this.vault.autoSave('context', `User: ${input.slice(0, 200)}\n\nULTRON: ${out.slice(0, 500)}`);
    this.session.record('chat', input.slice(0, 100), out.slice(0, 200));

    // Proactive memory: save profile if user reveals info about themselves
    this.proactiveMemory(input);

    if (this.configStore.turnCount > 0 && this.configStore.turnCount % SUMMARIZE_EVERY === 0) this.autoSummary();

    this.emit({ type: 'done', agent: 'Orchestrator', displayName: 'Cerebro', message: '' });
    this.activeController = null;
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
      try { const content = fileTools.readFile(f, this.config.projectDir); msg += `\n[@${f}]:\n` + content.slice(0, 1500); } catch (e: unknown) { log.warn('preprocess: readFile failed', { file: f, error: e instanceof Error ? e.message : String(e) }); }
    }
    return msg;
  }

  private proactiveMemory(input: string): void {
    try {
      const profile = this.vault.memoryRead('profile.md');
      const nameMatch = input.match(/(?:me llamo|mi nombre es|soy|i am|my name is)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
      const roleMatch = input.match(/(?:trabajo como|work as|i('?m| am) (?:an? )?)\s+([a-záéíóúñ\s]+(?:developer|engineer|designer|manager|programmer|coder|student|teacher|analyst|consultant))/i);
      const prefMatch = input.match(/(?:prefiero|me gusta|i prefer|i like)\s+([^.,]+)/i);

      if (!profile && (nameMatch || roleMatch)) {
        let facts = '';
        if (nameMatch) facts += `- [stated] nombre: ${nameMatch[1]}\n`;
        if (roleMatch) facts += `- [stated] rol: ${roleMatch[2]}\n`;
        this.vault.memoryWrite('profile.md', {
          name: 'profile',
          description: nameMatch ? `Perfil de ${nameMatch[1]}` : 'Perfil del usuario',
        }, `# Perfil\n${facts}`);
      } else if (prefMatch && profile && !profile.content.includes(prefMatch[1].trim())) {
        const existing = this.vault.memoryRead('preferences.md');
        this.vault.memoryWrite('preferences.md',
          { name: 'preferences', description: 'Preferencias del usuario' },
          (existing?.content || '# Preferencias\n') + `- [stated] ${prefMatch[1].trim()}\n`,
        );
      }
    } catch { /* best-effort */ }
  }

  private async runTool(name: string, args: Record<string, unknown>): Promise<{ result: string; retries: number }> {
    // Handle memory tools directly
    if (name === 'memory_write') {
      const filtered = filterPrivateInfo(args.content as string || '');
      const r = this.vault.memoryWrite(
        args.path as string,
        { name: args.name as string, description: args.description as string },
        filtered,
      );
      return { result: r === 'ok' ? 'Memoria guardada: ' + args.path : r, retries: 0 };
    }
    if (name === 'memory_read') {
      const r = this.vault.memoryRead(args.path as string);
      return { result: r ? JSON.stringify(r) : '(archivo no encontrado)', retries: 0 };
    }
    if (name === 'memory_list') {
      const files = this.vault.memoryList();
      return { result: files.length > 0 ? files.map(f => `- ${f.path}: ${f.description}`).join('\n') : '(memoria vacia)', retries: 0 };
    }
    if (name === 'memory_delete') {
      const r = this.vault.memoryDelete(args.path as string);
      return { result: r === 'ok' ? 'Eliminado: ' + args.path : r, retries: 0 };
    }

    // Session management tools
    if (name.startsWith('session_')) {
      return await this.runSessionTool(name, args);
    }

    // Graph Memory tools (code-graph-memory bridge)
    if (name.startsWith('graph_')) {
      return await this.runGraphTool(name, args);
    }

    const toolAgent = agentForTool(name);
    const isDelegation = name.startsWith('delegate_');

    // Track in shared context
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (isDelegation) {
      this.ctx.addTask(toolAgent, (args.task || args.content || '').toString(), taskId);
      this.emit({ type: 'delegate', agent: 'Orchestrator', displayName: 'Cerebro', message: `→ ${displayName(toolAgent)}: ${(args.task || args.content || '').toString().slice(0, 80)}`, data: { to: toolAgent, task: args } });
    }

    // Add shared context to delegation tasks so sub-agents can see what's been done
    if (isDelegation && typeof args.task === 'string') {
      const ctxSummary = this.ctx.toPromptContext();
      args.task = args.task + '\n\n' + ctxSummary;
    }

    // Pass current model to sub-agents so they use the same working model
    if (isDelegation) {
      const agentModel = this.currentModel;
      this.editor.setModel(agentModel);
      this.librarian.setModel(agentModel);
      this.basher.setModel(agentModel);
      this.researcher.setModel(agentModel);
      this.thinker.setModel(agentModel);
      this.reviewer.setModel(agentModel);
    }

    this.emit({ type: 'action', agent: toolAgent, displayName: displayName(toolAgent), message: toolLabel(name, args), data: args });
    log.tool(name, args, 'executing');
    const { result, retries } = await executeTool(name, args, this.config.projectDir, this.editor, this.librarian, this.basher, this.researcher, this.thinker, this.reviewer, this.architect);

    // Track results
    if (name === 'read_file') this.ctx.recordReadFile(args.filePath as string, result);
    if (name === 'write_file') this.ctx.recordWrittenFile(args.filePath as string, args.content as string);
    if (name === 'direct_execute') this.ctx.recordCommand(args.command as string, result, this.config.projectDir);
    if (isDelegation) this.ctx.completeTask(taskId, result);

    if (name === 'vault_save') this.vault.writeNote(args.name as string, args.content as string);
    log.tool(name, args, result.slice(0, 200));
    this.emit({ type: 'done', agent: toolAgent, displayName: displayName(toolAgent), message: toolLabel(name, args) + ' → ✓', data: { result: result.slice(0, 200) } });
    return { result, retries };
  }

  private async runSessionTool(name: string, args: Record<string, unknown>): Promise<{ result: string; retries: number }> {
    const sm = this.sessionManager;

    switch (name) {
      case 'session_list': {
        const sessions = sm.listSessions();
        if (sessions.length === 0) return { result: 'No hay sesiones.', retries: 0 };
        const lines = sessions.map(s => {
          const active = s.id === sm.getActiveId() ? ' *' : '  ';
          return `${active} ${s.id.slice(0, 12)}...  ${s.name.padEnd(20)} ${s.messageCount} msgs  ${new Date(s.updatedAt).toLocaleString()}`;
        });
        return { result: 'Sesiones:\n' + lines.join('\n'), retries: 0 };
      }
      case 'session_switch': {
        const id = args.id as string;
        const found = sm.listSessions().find(s => s.id.startsWith(id) || s.id === id);
        if (!found) return { result: `Sesion no encontrada: ${id}. Usa session_list para ver IDs.`, retries: 0 };
        // Save current conversation to current session
        const currentId = sm.getActiveId();
        sm.saveConversation(currentId, this.conversation);
        // Switch session
        sm.switchSession(found.id);
        this.session = sm.getActive();
        this.conversation = sm.getConversation(found.id);
        // Restore model for this session
        const sessionModel = sm.getSessionModel(found.id);
        if (sessionModel && getAllModels().some(m => m.model === sessionModel)) {
          this.currentModel = sessionModel;
        }
        return { result: `Sesion cambiada a: ${found.name} (${found.id.slice(0, 12)}...)`, retries: 0 };
      }
      case 'session_rename': {
        const ok = sm.renameSession(args.id as string, args.name as string);
        return { result: ok ? `Sesion renombrada a: ${args.name}` : 'Sesion no encontrada.', retries: 0 };
      }
      case 'session_delete': {
        const delId = args.id as string;
        const isActive = delId === sm.getActiveId();
        // Save current conversation first
        if (isActive) sm.saveConversation(sm.getActiveId(), this.conversation);
        const ok = sm.deleteSession(delId);
        if (ok && isActive) {
          this.session = sm.getActive();
          this.conversation = sm.getConversation(sm.getActiveId());
        }
        return { result: ok ? 'Sesion eliminada.' : 'No se pudo eliminar (minimo 1 sesion).', retries: 0 };
      }
      case 'session_new': {
        // Save current conversation first
        const currentId = sm.getActiveId();
        sm.saveConversation(currentId, this.conversation);
        // Create new session
        const newId = sm.createSession(args.name as string, this.currentModel);
        sm.switchSession(newId);
        this.session = sm.getActive();
        this.conversation = [];
        return { result: `Nueva sesion creada: ${sm.getMeta(newId).name} (${newId.slice(0, 12)}...)`, retries: 0 };
      }
      default:
        return { result: `Herramienta de sesion desconocida: ${name}`, retries: 0 };
    }
  }

  private async runGraphTool(name: string, args: Record<string, unknown>): Promise<{ result: string; retries: number }> {
    if (!this.graphMemory.isAvailable()) {
      return { result: 'Grafo de conocimiento no disponible. Instala code-graph-memory o usa /index para el grafo basico.', retries: 0 };
    }

    const toolAgent = 'GraphLearner';
    this.emit({ type: 'action', agent: toolAgent, displayName: 'Graph', message: name.replace('graph_', ''), data: args });

    try {
      let result = '';
      switch (name) {
        case 'graph_build':
          const dir = (args.directory as string) || this.config.projectDir;
          const r = await this.graphMemory.build(dir);
          result = `Grafo construido: ${r.nodes} nodos, ${r.edges} edges, ${r.files} archivos.`;
          break;
        case 'graph_search':
          result = (await this.graphMemory.search(args.query as string, args.type as string, (args.limit as number) || 10))
            .map((n: any) => n.text).join('\n') || 'Sin resultados.';
          break;
        case 'graph_related':
          result = await this.graphMemory.related(args.node as string, (args.depth as number) || 1);
          break;
        case 'graph_compact':
          const c = await this.graphMemory.compact(args.file as string);
          result = c?.content || 'No disponible.';
          break;
        case 'graph_overview':
          result = await this.graphMemory.overview();
          break;
        case 'graph_callers':
          result = await this.graphMemory.callers(args.name as string, (args.depth as number) || 1);
          break;
        case 'graph_dependencies':
          result = await this.graphMemory.dependencies(args.name as string);
          break;
        case 'graph_path':
          result = await this.graphMemory.path(args.from as string, args.to as string);
          break;
        case 'graph_concepts':
          const concepts = await this.graphMemory.concepts(args.query as string);
          result = concepts.map((c: any) => c.text).join('\n') || 'Sin conceptos.';
          break;
        case 'graph_stats':
          result = await this.graphMemory.stats();
          break;
        case 'graph_file_summary':
          result = await this.graphMemory.fileSummary(args.file as string);
          break;
        case 'graph_read_range':
          result = await this.graphMemory.readRange(args.file as string, args.start as number, args.end as number);
          break;
        default:
          result = `Tool desconocida: ${name}`;
      }

      this.emit({ type: 'done', agent: toolAgent, displayName: 'Graph', message: name.replace('graph_', '') + ' → ✓' });
      return { result, retries: 0 };
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      log.warn('Graph tool error', { tool: name, error: err });
      this.emit({ type: 'done', agent: toolAgent, displayName: 'Graph', message: name.replace('graph_', '') + ' → ✗' });
      return { result: `Error: ${err}`, retries: 0 };
    }
  }

  private async autoSummary(): Promise<void> {
    try {
      const recent = this.conversation.slice(-6);
      const text = recent.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
      const r = await chatCompletion({ model: this.currentModel || 'deepseek-chat', messages: [{ role: 'user', content: buildSummarizePrompt(text) }], temperature: 0.3, max_tokens: 200 });
      const j = r.content?.match(/\{[\s\S]*\}/);
      if (j) { const p = JSON.parse(j[0]); if (p.summary) this.vault.autoSave('context', `[summary]\n${p.summary}`); }
    } catch (e: unknown) {
      log.warn('autoSummary failed', { error: e instanceof Error ? e.message : String(e) });
    }
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
      d('str_replace', 'Reemplaza texto en archivo', { filePath: { type: 'string' }, oldStr: { type: 'string' }, newStr: { type: 'string' } }, ['filePath', 'oldStr', 'newStr']),
      d('browse_url', 'Abre URL en navegador', { url: { type: 'string' } }, ['url']),
      d('open_app', 'Abre aplicacion', { app: { type: 'string' } }, ['app']),
      d('analyze_document', 'Analiza documento (PDF, DOCX, XLSX, PPTX, EPUB, RTF, ZIP, Imagenes, Audio/Video, TXT, y 20+ formatos mas)', { filePath: { type: 'string' } }, ['filePath']),
      d('memory_write', 'Guarda un dato en la memoria persistente (sistema Claude-style)', { path: { type: 'string', description: 'ruta del archivo (ej: profile.md, topics/comida.md)' }, name: { type: 'string' }, description: { type: 'string' }, content: { type: 'string' } }, ['path', 'name', 'description', 'content']),
      d('memory_read', 'Lee un archivo de la memoria', { path: { type: 'string' } }, ['path']),
      d('memory_list', 'Lista todos los archivos de la memoria', {}, []),
      d('memory_delete', 'Elimina un archivo de la memoria (solo si el usuario lo pide)', { path: { type: 'string' } }, ['path']),
      d('run_lint', 'SOLO cuando el usuario lo pida explicitamente: ejecuta typecheck/lint', {}, []),
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
      // Graph Memory tools (code-graph-memory integration)
      d('graph_search', 'Busca clases, funciones, interfaces por nombre en el grafo de conocimiento', { query: { type: 'string' }, type: { type: 'string' }, limit: { type: 'number' } }, ['query']),
      d('graph_related', 'Muestra relaciones de un nodo en el grafo (dependencias, usos)', { node: { type: 'string' }, depth: { type: 'number' } }, ['node']),
      d('graph_compact', 'Resumen compacto de un archivo (clases, funciones, firmas)', { file: { type: 'string' } }, ['file']),
      d('graph_overview', 'Vista general del proyecto: modulos, patrones, estadisticas', {}, []),
      d('graph_callers', 'Encuentra quien llama/usar una funcion o clase', { name: { type: 'string' }, depth: { type: 'number' } }, ['name']),
      d('graph_dependencies', 'Muestra todas las dependencias de un nodo (que importa/usa)', { name: { type: 'string' } }, ['name']),
      d('graph_path', 'Encuentra el camino de dependencia entre dos nodos', { from: { type: 'string' }, to: { type: 'string' } }, ['from', 'to']),
      d('graph_concepts', 'Muestra conceptos arquitectonicos y patrones detectados', { query: { type: 'string' } }, []),
      d('graph_stats', 'Estadisticas del grafo de conocimiento', {}, []),
      d('graph_build', 'Indexa el proyecto en el grafo de conocimiento (AST parsing)', { directory: { type: 'string' } }, []),
      d('graph_file_summary', 'Resumen detallado de un archivo (estructura, imports, exports)', { file: { type: 'string' } }, ['file']),
      d('graph_read_range', 'Lee lineas especificas de un archivo usando el grafo', { file: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, ['file', 'start', 'end']),
      // Session management tools
      d('session_list', 'Lista todas las sesiones disponibles con su estado', {}, []),
      d('session_switch', 'Cambia a otra sesion por ID', { id: { type: 'string' } }, ['id']),
      d('session_rename', 'Renombra una sesion', { id: { type: 'string' }, name: { type: 'string' } }, ['id', 'name']),
      d('session_delete', 'Elimina una sesion', { id: { type: 'string' } }, ['id']),
      d('session_new', 'Crea una nueva sesion', { name: { type: 'string' }, model: { type: 'string' } }, []),
    ];
  }
}

function looksLikeFunctionCallStart(buf: string): boolean {
  const t = buf.trimStart();
  if (t.startsWith('{"type":"function"') || t.startsWith('{"type":"function"') || t.startsWith('[{"type":"function"')) return true;
  if (t.startsWith('{') || t.startsWith('[')) {
    try { const p = JSON.parse(t); return !!(p?.type === 'function' || (Array.isArray(p) && p[0]?.type === 'function')); } catch { /* JSON parse attempt */ }
  }
  return false;
}

function tryParseTextToolCalls(content: string | null): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | null {
  if (!content) return null;
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.type === 'function' && parsed.name) {
      return [{ id: 'fc_' + parsed.name, type: 'function', function: { name: parsed.name, arguments: JSON.stringify(parsed.parameters || {}) } }];
    }
    if (Array.isArray(parsed)) {
      const tcs = parsed.filter(p => p.type === 'function' && p.name).map((p, i) => ({
        id: 'fc_' + (p.name || i), type: 'function' as const, function: { name: p.name, arguments: JSON.stringify(p.parameters || {}) }
      }));
      if (tcs.length) return tcs;
    }
  } catch { /* JSON parse fallback */ }
  const singleMatch = trimmed.match(/\{"type"\s*:\s*"function"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[\s\S]*?\})\s*\}/);
  if (singleMatch) {
    try { const p = JSON.parse(singleMatch[2]); return [{ id: 'fc_' + singleMatch[1], type: 'function', function: { name: singleMatch[1], arguments: JSON.stringify(p) } }]; } catch { /* parse attempt */ }
  }
  const arrayMatch = trimmed.match(/\[\s*\{[^]*?"type"\s*:\s*"function"[^]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]);
      if (Array.isArray(arr)) return arr.filter(p => p.type === 'function' && p.name).map((p, i) => ({
        id: 'fc_' + (p.name || i), type: 'function' as const, function: { name: p.name, arguments: JSON.stringify(p.parameters || {}) }
      }));
    } catch { /* JSON parse fallback */ }
  }
  return null;
}
