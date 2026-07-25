import type { Orchestrator } from '../agents/orchestrator';
import type { ToolDefinition } from '../shared/types';
import { log } from '../shared/logger';
import type {
  MCPRequest,
  MCPResponse,
  MCPToolDefinition,
  MCPToolResult,
  MCPResource,
  MCPPrompt,
  ToolHandler,
} from './types';
import { MCP_ERROR_CODES } from './types';

export class MCPServer {
  private orchestrator: Orchestrator;
  private tools: Map<string, ToolHandler> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private initialized = false;
  private clientCapabilities: Record<string, unknown> = {};
  private serverInfo = {
    name: 'ultron-mcp',
    version: '5.1.0',
  };

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
  }

  async init(): Promise<void> {
    this.initialized = true;
    log.info('MCP Server initialized');
  }

  registerTool(name: string, handler: ToolHandler): void {
    this.tools.set(name, handler);
  }

  registerToolsFromDefinitions(toolDefs: ToolDefinition[]): void {
    for (const def of toolDefs) {
      const name = def.function.name;
      if (!this.tools.has(name)) {
        this.tools.set(name, async (args) => {
          const result = await this.executeOrchestratorTool(name, args);
          return result;
        });
      }
    }
  }

  registerResource(uri: string, resource: MCPResource): void {
    this.resources.set(uri, resource);
  }

  registerPrompt(name: string, prompt: MCPPrompt): void {
    this.prompts.set(name, prompt);
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'ping':
          return this.createResponse(request.id, {});
        case 'tools/list':
          return this.handleListTools(request);
        case 'tools/call':
          return await this.handleCallTool(request);
        case 'resources/list':
          return this.handleListResources(request);
        case 'resources/read':
          return await this.handleReadResource(request);
        case 'prompts/list':
          return this.handleListPrompts(request);
        case 'prompts/get':
          return this.handleGetPrompt(request);
        case 'notifications/initialized':
          return this.createResponse(null, null);
        default:
          return this.createError(request.id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
      }
    } catch (error) {
      log.error('MCP handler error', { method: request.method, error: String(error) });
      return this.createError(request.id, MCP_ERROR_CODES.INTERNAL_ERROR, String(error));
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    if (request.params && typeof request.params === 'object') {
      this.clientCapabilities = (request.params as Record<string, unknown>).capabilities as Record<string, unknown> || {};
    }
    return this.createResponse(request.id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: this.serverInfo,
    });
  }

  private handleListTools(request: MCPRequest): MCPResponse {
    const toolList: MCPToolDefinition[] = [];
    for (const [name] of this.tools) {
      toolList.push({
        name,
        description: `ULTRON tool: ${name}`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }
    return this.createResponse(request.id, { tools: toolList });
  }

  private async handleCallTool(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as Record<string, unknown> || {};
    const toolName = params.name as string;
    const args = (params.arguments as Record<string, unknown>) || {};

    const handler = this.tools.get(toolName);
    if (!handler) {
      return this.createError(request.id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Tool not found: ${toolName}`);
    }

    try {
      const result = await handler(args);
      return this.createResponse(request.id, result);
    } catch (error) {
      return this.createError(request.id, MCP_ERROR_CODES.TOOL_EXECUTION_ERROR, `Tool execution error: ${String(error)}`);
    }
  }

  private handleListResources(request: MCPRequest): MCPResponse {
    const resources = Array.from(this.resources.values());
    return this.createResponse(request.id, { resources });
  }

  private async handleReadResource(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as Record<string, unknown> || {};
    const uri = params.uri as string;
    const resource = this.resources.get(uri);
    if (!resource) {
      return this.createError(request.id, MCP_ERROR_CODES.INVALID_PARAMS, `Resource not found: ${uri}`);
    }
    return this.createResponse(request.id, {
      contents: [{ uri: resource.uri, mimeType: resource.mimeType || 'text/plain', text: `Resource: ${resource.name}` }],
    });
  }

  private handleListPrompts(request: MCPRequest): MCPResponse {
    const prompts = Array.from(this.prompts.values());
    return this.createResponse(request.id, { prompts });
  }

  private handleGetPrompt(request: MCPRequest): MCPResponse {
    const params = request.params as Record<string, unknown> || {};
    const promptName = params.name as string;
    const prompt = this.prompts.get(promptName);
    if (!prompt) {
      return this.createError(request.id, MCP_ERROR_CODES.INVALID_PARAMS, `Prompt not found: ${promptName}`);
    }
    return this.createResponse(request.id, { prompt });
  }

  private async executeOrchestratorTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const result = await this.orchestrator.executeToolDirectly(name, args);
      return {
        content: [{ type: 'text', text: result.result || String(result) }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${String(error)}` }],
        isError: true,
      };
    }
  }

  getToolList(): MCPToolDefinition[] {
    return Array.from(this.tools.keys()).map((name) => ({
      name,
      description: `ULTRON tool: ${name}`,
      inputSchema: { type: 'object', properties: {} },
    }));
  }

  private createResponse(id: string | number | null | undefined, result: unknown): MCPResponse {
    return { jsonrpc: '2.0', id: id ?? null, result };
  }

  private createError(id: string | number | null | undefined, code: number, message: string, data?: unknown): MCPResponse {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
  }
}
