import { exec, spawn } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  error: string | null;
  code: number | null;
}

export function executeCommand(
  command: string,
  cwd: string,
  timeout = 30000,
): Promise<ExecResult> {
  return new Promise(resolve => {
    exec(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    },     (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        error: err ? err.message : null,
        code: err && (err as NodeJS.ErrnoException).code ? 1 : err ? null : 0,
      });
    });
  });
}

export function executeStreaming(
  command: string,
  cwd: string,
  onData: (data: string) => void,
  timeout = 60000,
): Promise<ExecResult> {
  return new Promise(resolve => {
    const child = spawn(command, [], {
      cwd,
      shell: true,
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      onData(text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      onData(text);
    });

    child.on('close', code => {
      resolve({ stdout, stderr, error: null, code });
    });

    child.on('error', err => {
      resolve({ stdout, stderr, error: err.message, code: null });
    });
  });
}
