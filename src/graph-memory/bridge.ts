import * as path from 'path';
import * as fs from 'fs';
import { log } from '../shared/logger';

let _GraphMemoryServer: any = null;

function findCGMModule(): string | null {
  const candidates = [
    path.join(process.cwd(), '..', 'code-graph-memory', 'dist', 'mcp', 'server.js'),
    path.join(process.cwd(), 'node_modules', 'code-graph-memory', 'dist', 'mcp', 'server.js'),
    path.join(__dirname, '..', '..', '..', 'code-graph-memory', 'dist', 'mcp', 'server.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function loadCGM(): Promise<any> {
  if (_GraphMemoryServer) return _GraphMemoryServer;
  const modulePath = findCGMModule();
  if (!modulePath) return null;
  try {
    const mod = await import(modulePath);
    _GraphMemoryServer = mod.GraphMemoryServer;
    return _GraphMemoryServer;
  } catch (e) {
    try {
      const mod = require(modulePath);
      _GraphMemoryServer = mod.GraphMemoryServer;
      return _GraphMemoryServer;
    } catch (e2) {
      log.warn('code-graph-memory not available, using built-in graph', { error: String(e2) });
      return null;
    }
  }
}

export class GraphMemoryBridge {
  private server: any;
  private workspaceDir: string;
  private initialized = false;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    const GraphMemoryServerClass = await loadCGM();
    if (!GraphMemoryServerClass) return false;

    try {
      this.server = new GraphMemoryServerClass(this.workspaceDir);
      this.server.loadExistingData();
      this.initialized = true;
      log.info('GraphMemoryBridge initialized', { workspace: this.workspaceDir });
      return true;
    } catch (e) {
      log.warn('GraphMemoryBridge init failed', { error: String(e) });
      return false;
    }
  }

  async build(directory?: string): Promise<{ nodes: number; edges: number; files: number }> {
    if (!this.server) await this.init();

    const result = await this.server.executeTool('graph_build', {
      directory: directory || this.workspaceDir,
    });
    return this.parseBuildResult(result);
  }

  async search(query: string, type?: string, limit = 10): Promise<any[]> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_search', { query, type, limit });
    return this.parseResults(result);
  }

  async related(node: string, depth = 1): Promise<any> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_related', { node, depth });
    return result.content[0]?.text || '';
  }

  async compact(file: string): Promise<{ content: string; tokens: number } | null> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_compact', { file });
    const text = result.content[0]?.text || '';
    const tokenMatch = text.match(/Estimated tokens: (\d+)/);
    return {
      content: text,
      tokens: tokenMatch ? parseInt(tokenMatch[1], 10) : 0,
    };
  }

  async readRange(file: string, start: number, end: number): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_read_range', { file, start, end });
    return result.content[0]?.text || '';
  }

  async concepts(query?: string): Promise<any[]> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_concepts', { query: query || '' });
    return this.parseResults(result);
  }

  async overview(): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_overview', {});
    return result.content[0]?.text || '';
  }

  async stats(): Promise<any> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_stats', {});
    return result.content[0]?.text || '';
  }

  async fileSummary(file: string): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_file_summary', { file });
    return result.content[0]?.text || '';
  }

  async callers(name: string, depth = 1): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_callers', { name, depth });
    return result.content[0]?.text || '';
  }

  async dependencies(name: string): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_dependencies', { name });
    return result.content[0]?.text || '';
  }

  async path(from: string, to: string): Promise<string> {
    if (!this.server) await this.init();
    const result = await this.server.executeTool('graph_path', { from, to });
    return result.content[0]?.text || '';
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getServer(): any {
    return this.server;
  }

  private parseBuildResult(result: any): { nodes: number; edges: number; files: number } {
    const text = result.content[0]?.text || '';
    const nodesMatch = text.match(/Nodes:\s*(\d+)/);
    const edgesMatch = text.match(/Edges:\s*(\d+)/);
    const filesMatch = text.match(/Files:\s*(\d+)/);
    return {
      nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : 0,
      edges: edgesMatch ? parseInt(edgesMatch[1], 10) : 0,
      files: filesMatch ? parseInt(filesMatch[1], 10) : 0,
    };
  }

  private parseResults(result: any): any[] {
    const text = result.content[0]?.text || '';
    const lines = text.split('\n').filter((l: string) => l.trim());
    return lines.map((l: string) => ({ text: l }));
  }
}
