// src/tools/mcp.ts
// MCP (Model Context Protocol) client - conecta herramientas externas

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  tools: MCPServerTool[];
}

interface MCPServerTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

let servers: MCPServer[] = [];

export async function loadMCPServers(configPath?: string): Promise<void> {
  servers = [];
  try {
    const fs = await import('fs');
    const path = await import('path');
    const cPath = configPath || path.join(process.cwd(), 'jarvis-mcp.json');
    if (fs.existsSync(cPath)) {
      const config = JSON.parse(fs.readFileSync(cPath, 'utf8'));
      for (const [name, srv] of Object.entries(config.servers || {})) {
        const s = srv as { command: string; args: string[] };
        servers.push({
          name,
          command: s.command,
          args: s.args || [],
          tools: [],
        });
      }
    }
  } catch {}
}

export function getMCPServers(): MCPServer[] {
  return servers;
}

export async function callMCPTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  const server = servers.find(s => s.name === serverName);
  if (!server) return `MCP server "${serverName}" not found`;

  try {
    const { spawn } = await import('child_process');
    const child = spawn(server.command, server.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });

    child.stdin.write(request + '\n');
    child.stdin.end();

    let output = '';
    for await (const chunk of child.stdout) output += chunk.toString();
    return output.slice(0, 5000);
  } catch (e: unknown) {
    return 'MCP error: ' + (e instanceof Error ? e.message : String(e));
  }
}
