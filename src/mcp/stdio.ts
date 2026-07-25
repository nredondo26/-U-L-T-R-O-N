import * as readline from 'readline';
import { MCPServer } from './server';
import type { MCPRequest, MCPResponse } from './types';
import { log } from '../shared/logger';

export class StdioTransport {
  private server: MCPServer;
  private rl: readline.Interface | null = null;
  private running = false;

  constructor(server: MCPServer) {
    this.server = server;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', async (line: string) => {
      try {
        const request: MCPRequest = JSON.parse(line);
        const response = await this.server.handleRequest(request);
        if (response.id !== null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (error) {
        log.error('MCP stdio parse error', { error: String(error) });
        const errorResponse: MCPResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${String(error)}`,
          },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    this.rl.on('close', () => {
      this.running = false;
    });
  }

  stop(): void {
    this.running = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
