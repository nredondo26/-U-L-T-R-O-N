// src/tools/git.ts
// Operaciones Git

import { executeCommand } from './execute';

export async function gitCommand(args: string[], cwd: string): Promise<string> {
  const result = await executeCommand('git ' + args.join(' '), cwd, 15000);
  return result.stdout || result.stderr || result.error || 'OK';
}

export async function gitStatus(cwd: string): Promise<string> {
  return gitCommand(['status', '--short'], cwd);
}

export async function gitLog(cwd: string, n = 10): Promise<string> {
  return gitCommand(['log', '--oneline', `-${n}`], cwd);
}

export async function gitDiff(cwd: string, staged = false): Promise<string> {
  const args = staged ? ['diff', '--staged'] : ['diff'];
  return gitCommand(args, cwd);
}

export async function gitCommit(cwd: string, message: string): Promise<string> {
  return gitCommand(['commit', '-m', message], cwd);
}

export async function gitBranches(cwd: string): Promise<string> {
  return gitCommand(['branch', '-a'], cwd);
}
