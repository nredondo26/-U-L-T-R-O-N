import { log } from '../shared/logger';

export interface ReadFileRecord {
  path: string;
  content: string;
  timestamp: number;
}

export interface WrittenFileRecord {
  path: string;
  content: string;
  timestamp: number;
}

export interface ExecutedCommandRecord {
  command: string;
  output: string;
  cwd: string;
  timestamp: number;
}

export interface AgentTaskRecord {
  agent: string;
  task: string;
  result: string;
  completed: boolean;
  timestamp: number;
  id: string;
}

export interface ProjectStructure {
  files: string[];
  dirs: string[];
  lastUpdated: number;
}

export class SharedContext {
  private readFiles: Map<string, ReadFileRecord> = new Map();
  private writtenFiles: Map<string, WrittenFileRecord> = new Map();
  private executedCommands: ExecutedCommandRecord[] = [];
  private agentTasks: AgentTaskRecord[] = [];
  private projectStructure: ProjectStructure | null = null;
  private errors: string[] = [];
  private currentProjectDir: string = '';
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  recordReadFile(path: string, content: string): void {
    this.readFiles.set(path.toLowerCase(), { path, content, timestamp: Date.now() });
  }

  getReadFile(path: string): string | null {
    const record = this.readFiles.get(path.toLowerCase());
    return record?.content || null;
  }

  hasReadFile(path: string): boolean {
    return this.readFiles.has(path.toLowerCase());
  }

  recordWrittenFile(path: string, content: string): void {
    this.writtenFiles.set(path.toLowerCase(), { path, content, timestamp: Date.now() });
  }

  getWrittenFiles(): WrittenFileRecord[] {
    return Array.from(this.writtenFiles.values());
  }

  recordCommand(command: string, output: string, cwd: string): void {
    this.executedCommands.push({ command, output, cwd, timestamp: Date.now() });
    if (this.executedCommands.length > 50) this.executedCommands = this.executedCommands.slice(-50);
  }

  hasRunCommand(command: string): boolean {
    return this.executedCommands.some(c => c.command === command);
  }

  getCommandOutput(command: string): string | null {
    const cmd = this.executedCommands.find(c => c.command === command);
    return cmd?.output || null;
  }

  addTask(agent: string, task: string, id: string): void {
    this.agentTasks.push({
      agent, task, result: '', completed: false, timestamp: Date.now(), id
    });
  }

  completeTask(id: string, result: string): void {
    const task = this.agentTasks.find(t => t.id === id);
    if (task) { task.completed = true; task.result = result; task.timestamp = Date.now(); }
  }

  getPendingTasks(): AgentTaskRecord[] {
    return this.agentTasks.filter(t => !t.completed);
  }

  getCompletedTasks(): AgentTaskRecord[] {
    return this.agentTasks.filter(t => t.completed);
  }

  isTaskCompleted(taskId: string): boolean {
    return this.agentTasks.some(t => t.id === taskId && t.completed);
  }

  setProjectDir(dir: string): void {
    this.currentProjectDir = dir;
  }

  getProjectDir(): string {
    return this.currentProjectDir;
  }

  setProjectStructure(files: string[], dirs: string[]): void {
    this.projectStructure = { files, dirs, lastUpdated: Date.now() };
  }

  getProjectStructure(): ProjectStructure | null {
    return this.projectStructure;
  }

  addError(error: string): void {
    this.errors.push(error);
    if (this.errors.length > 20) this.errors = this.errors.slice(-20);
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  getSummary(maxEntries = 10): string {
    const lines: string[] = [];

    if (this.projectStructure) {
      lines.push(`Project: ${this.currentProjectDir}`);
      lines.push(`Files: ${this.projectStructure.files.length}`);
    }
    if (this.readFiles.size > 0) {
      lines.push(`Read files (${this.readFiles.size}): ${Array.from(this.readFiles.keys()).slice(0, 5).join(', ')}${this.readFiles.size > 5 ? ` +${this.readFiles.size - 5} more` : ''}`);
    }
    if (this.writtenFiles.size > 0) {
      lines.push(`Written files (${this.writtenFiles.size}): ${Array.from(this.writtenFiles.keys()).slice(0, 5).join(', ')}`);
    }
    if (this.executedCommands.length > 0) {
      const recent = this.executedCommands.slice(-3).map(c => c.command);
      lines.push(`Commands: ${recent.join(' | ')}`);
    }
    const completed = this.getCompletedTasks().length;
    const pending = this.getPendingTasks().length;
    if (completed + pending > 0) {
      lines.push(`Tasks: ${completed} completed, ${pending} pending`);
    }

    return lines.join('\n');
  }

  toPromptContext(): string {
    const lines: string[] = ['=== SHARED CONTEXT ==='];

    if (this.projectStructure) {
      lines.push(`Project directory: ${this.currentProjectDir}`);
      lines.push(`Files in project: ${this.projectStructure.files.length}`);
    }

    if (this.writtenFiles.size > 0) {
      lines.push('Files created/modified:');
      for (const [, wf] of this.writtenFiles) {
        lines.push(`  - ${wf.path}`);
      }
    }

    if (this.executedCommands.length > 0) {
      const recent = this.executedCommands.slice(-5);
      lines.push('Recent commands:');
      for (const cmd of recent) {
        lines.push(`  $ ${cmd.command} (exit in ${cmd.output.length} chars)`);
      }
    }

    const pending = this.getPendingTasks();
    if (pending.length > 0) {
      lines.push('Pending tasks:');
      for (const t of pending) {
        lines.push(`  - [${t.agent}] ${t.task.slice(0, 80)}`);
      }
    }

    const completed = this.getCompletedTasks();
    if (completed.length > 0) {
      lines.push('Completed tasks:');
      for (const t of completed.slice(-5)) {
        lines.push(`  - ✓ [${t.agent}] ${t.task.slice(0, 80)}`);
      }
    }

    return lines.join('\n');
  }
}
