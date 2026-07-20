// src/tools/sandbox.ts
// Ejecucion segura de comandos con confirmacion y allowlist

import { executeCommand } from './execute';
import { log } from '../shared/logger';

type SandboxMode = 'ask' | 'allow' | 'deny' | 'session-allow';

interface SandboxConfig {
  mode: SandboxMode;
  allowlist: string[];
  denylist: string[];
  sessionAllowAll: boolean;
}

let config: SandboxConfig = {
  mode: 'ask',
  allowlist: ['npm', 'npx', 'bun', 'node', 'tsc', 'git', 'echo', 'dir', 'ls', 'cat', 'type', 'code', 'cd', 'pwd', 'mkdir', 'copy', 'move', 'python', 'pip'],
  denylist: ['rm -rf', 'del /f', 'format', 'shutdown', 'restart', ':(){', 'chmod 777', '> /dev/sda', 'dd if='],
  sessionAllowAll: false,
};

export function getSandboxConfig(): SandboxConfig { return { ...config }; }

export function setSandboxMode(mode: SandboxMode): void {
  config.mode = mode;
  if (mode === 'deny') config.sessionAllowAll = false; // Reset session allow
  log.info(`Sandbox mode: ${mode}`);
}

export function allowAll(): void {
  config.sessionAllowAll = true;
  log.info('Sandbox: all commands allowed for this session');
}

export function addAllow(cmd: string): void {
  if (!config.allowlist.includes(cmd)) config.allowlist.push(cmd);
  log.info(`Sandbox allowlist: added ${cmd}`);
}

export function checkCommand(command: string): { allowed: boolean; reason: string } {
  // Session allow-all
  if (config.sessionAllowAll) return { allowed: true, reason: 'session-allow-all' };

  // Check denylist first (dangerous patterns)
  const lower = command.toLowerCase();
  for (const pattern of config.denylist) {
    if (lower.includes(pattern.toLowerCase())) {
      log.warn(`Sandbox: blocked dangerous command`, { command, pattern });
      return { allowed: false, reason: `Comando bloqueado: contiene "${pattern}". Es peligroso.` };
    }
  }

  // Check allowlist (exact match only, no prefix matching)
  const cmdName = command.split(/\s+/)[0].toLowerCase();
  if (config.allowlist.includes(cmdName)) {
    return { allowed: true, reason: 'allowlist' };
  }

  // Ask mode
  if (config.mode === 'ask') {
    return { allowed: true, reason: 'ask-mode (shown to user)' };
  }

  if (config.mode === 'allow') return { allowed: true, reason: 'allow-mode' };
  if (config.mode === 'deny') return { allowed: false, reason: 'deny-mode' };

  return { allowed: false, reason: 'unknown' };
}

export async function sandboxedExec(command: string, cwd: string): Promise<string> {
  const check = checkCommand(command);
  if (!check.allowed) {
    return `BLOQUEADO: ${check.reason}`;
  }

  log.tool('sandbox-exec', { command, cwd }, 'executing');
  const result = await executeCommand(command, cwd, 60000);

  if (result.error || result.code !== 0) {
    log.warn(`Command failed: ${command}`, { error: result.error, stderr: result.stderr });
  }

  const output = [
    result.stdout ? `STDOUT:\n${result.stdout.slice(0, 3000)}` : '',
    result.stderr ? `STDERR:\n${result.stderr.slice(0, 1000)}` : '',
    result.error ? `ERROR: ${result.error}` : '',
    result.code !== null ? `EXIT: ${result.code}` : '',
  ].filter(Boolean).join('\n');

  return output || 'OK (sin output)';
}
