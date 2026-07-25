import * as fs from 'fs';
import * as path from 'path';
import { ensureDir } from './utils';
import { log } from './logger';

export interface UltronConfig {
  version: string;
  project: ProjectConfig;
  agents: AgentsConfig;
  models: ModelsConfig;
  memory: MemoryConfig;
  mcp: MCPConfig;
  skills: SkillsConfig;
  watcher: WatcherConfig;
  security: SecurityConfig;
  ui: UIConfig;
}

export interface ProjectConfig {
  name: string;
  description: string;
  rootDir: string;
  vaultDir: string;
  ignoreDirs: string[];
  ignorePatterns: string[];
}

export interface AgentsConfig {
  enabled: string[];
  maxSteps: number;
  defaultAgent: string;
  verbose: boolean;
  autoDelegate: boolean;
  delegationStrategy: 'string' | 'structured' | 'multi-step';
  sharedContext: boolean;
}

export interface ModelsConfig {
  provider: string;
  defaultModel: string;
  agentModels: Record<string, string>;
  fallbackChain: string[];
  freeFirst: boolean;
  circuitBreaker: CircuitBreakerConfig;
  costTracking: CostTrackingConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  maxRetries: number;
  cooldownMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
}

export interface CostTrackingConfig {
  enabled: boolean;
  monthlyBudget: number;
  sessionBudget: number;
  warnAt: number;
}

export interface MemoryConfig {
  vaultType: 'obsidian' | 'json' | 'both';
  graphMemory: boolean;
  autoSummarize: boolean;
  summarizeEvery: number;
  maxHistoryMessages: number;
  sessionRetention: number;
}

export interface MCPConfig {
  enabled: boolean;
  serverMode: 'stdio' | 'http' | 'both';
  port: number;
  tools: string[];
  allowCustomTools: boolean;
}

export interface SkillsConfig {
  enabled: boolean;
  dirs: string[];
  autoLoad: boolean;
  defaultSkill: string;
}

export interface WatcherConfig {
  enabled: boolean;
  debounceMs: number;
  watchDirs: string[];
  watchExtensions: string[];
  autoIndex: boolean;
  onFileChange: string[];
}

export interface SecurityConfig {
  sandboxMode: 'ask' | 'allow' | 'deny';
  allowedCommands: string[];
  apiKeyAuth: boolean;
  corsOrigins: string[];
  rateLimiting: boolean;
  maxBodySize: number;
}

export interface UIConfig {
  theme: string;
  showAgentPanel: boolean;
  showTokenCounter: boolean;
  compactMode: boolean;
  language: string;
}

const DEFAULT_CONFIG: UltronConfig = {
  version: '5.1.0',
  project: {
    name: '',
    description: '',
    rootDir: '.',
    vaultDir: './vault',
    ignoreDirs: ['node_modules', '.git', 'dist', 'build', '.gradle', '__pycache__'],
    ignorePatterns: ['*.min.js', '*.min.css', '*.map'],
  },
  agents: {
    enabled: ['orchestrator', 'editor', 'librarian', 'basher', 'researcher', 'thinker', 'reviewer', 'architect'],
    maxSteps: 25,
    defaultAgent: 'orchestrator',
    verbose: true,
    autoDelegate: true,
    delegationStrategy: 'structured',
    sharedContext: true,
  },
  models: {
    provider: 'dashscope',
    defaultModel: 'deepseek-chat',
    agentModels: {},
    fallbackChain: [],
    freeFirst: true,
    circuitBreaker: {
      enabled: true,
      maxRetries: 3,
      cooldownMs: 60000,
      failureThreshold: 5,
      recoveryThreshold: 2,
    },
    costTracking: {
      enabled: true,
      monthlyBudget: 0,
      sessionBudget: 0,
      warnAt: 0.8,
    },
  },
  memory: {
    vaultType: 'obsidian',
    graphMemory: true,
    autoSummarize: true,
    summarizeEvery: 12,
    maxHistoryMessages: 20,
    sessionRetention: 24 * 60 * 60 * 1000,
  },
  mcp: {
    enabled: true,
    serverMode: 'stdio',
    port: 3457,
    tools: ['*'],
    allowCustomTools: true,
  },
  skills: {
    enabled: true,
    dirs: ['.opencode/skills'],
    autoLoad: true,
    defaultSkill: '',
  },
  watcher: {
    enabled: false,
    debounceMs: 500,
    watchDirs: ['src'],
    watchExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.kt', '.java', '.go', '.rs'],
    autoIndex: true,
    onFileChange: ['graph_index'],
  },
  security: {
    sandboxMode: 'ask',
    allowedCommands: [],
    apiKeyAuth: false,
    corsOrigins: ['*'],
    rateLimiting: true,
    maxBodySize: 1048576,
  },
  ui: {
    theme: 'ultron',
    showAgentPanel: true,
    showTokenCounter: true,
    compactMode: false,
    language: 'es',
  },
};

export class UltronConfigStore {
  private config: UltronConfig;
  private configPath: string;
  private vaultConfigPath: string;

  constructor(projectDir: string, vaultDir: string) {
    this.configPath = path.join(projectDir, 'ultron.json');
    this.vaultConfigPath = path.join(vaultDir, 'ultron-config.json');
    this.config = this.load();
  }

  private findExistingConfig(): string | null {
    const candidates = [
      this.configPath,
      this.vaultConfigPath,
      path.join(process.cwd(), 'ultron.json'),
      path.join(process.cwd(), '.ultron.json'),
      path.join(process.cwd(), 'ultron.config.json'),
    ];
    for (const cp of candidates) {
      if (fs.existsSync(cp)) return cp;
    }
    return null;
  }

  private load(): UltronConfig {
    const existingPath = this.findExistingConfig();
    if (existingPath) {
      try {
        const raw = fs.readFileSync(existingPath, 'utf8');
        const parsed = JSON.parse(raw);
        const merged = this.deepMerge(DEFAULT_CONFIG, parsed);
        log.info('UltronConfig loaded', { path: existingPath });
        return merged;
      } catch (e: unknown) {
        log.warn('UltronConfig load failed, using defaults', { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { ...DEFAULT_CONFIG, version: '5.1.0' };
  }

  save(): void {
    try {
      ensureDir(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      log.info('UltronConfig saved', { path: this.configPath });
    } catch (e: unknown) {
      log.warn('Failed to save ultron config', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  get(): UltronConfig {
    return this.config;
  }

  getProject(): ProjectConfig {
    return this.config.project;
  }

  getAgents(): AgentsConfig {
    return this.config.agents;
  }

  getModels(): ModelsConfig {
    return this.config.models;
  }

  getMemory(): MemoryConfig {
    return this.config.memory;
  }

  getMCP(): MCPConfig {
    return this.config.mcp;
  }

  getSkills(): SkillsConfig {
    return this.config.skills;
  }

  getWatcher(): WatcherConfig {
    return this.config.watcher;
  }

  getSecurity(): SecurityConfig {
    return this.config.security;
  }

  getUI(): UIConfig {
    return this.config.ui;
  }

  update(partial: Partial<UltronConfig>): void {
    this.config = this.deepMerge(this.config, partial);
    this.save();
  }

  set<K extends keyof UltronConfig>(key: K, value: UltronConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const val = source[key];
      if (val !== undefined && val !== null) {
        if (typeof val === 'object' && !Array.isArray(val) && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = this.deepMerge(target[key], val);
        } else {
          result[key] = val;
        }
      }
    }
    return result;
  }

  generateDefaultConfig(): UltronConfig {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
    return this.config;
  }

  initProjectConfig(projectName: string, description: string): UltronConfig {
    this.config.project.name = projectName;
    this.config.project.description = description;
    this.save();
    return this.config;
  }
}
