// src/tools/git-workflow.ts
// Git auto-commit, diff viewer, PR preparation

import { executeCommand } from './execute';

export async function gitAutoCommit(projectDir: string, message?: string): Promise<string> {
  // Stage all changes
  const add = await executeCommand('git add -A', projectDir, 10000);
  if (add.error) return `Error staging: ${add.error}`;

  // Check if there's anything to commit
  const diff = await executeCommand('git diff --cached --stat', projectDir, 10000);
  if (!diff.stdout.trim()) return 'No hay cambios para commitear.';

  // Generate commit message if not provided
  const commitMsg = message || 'auto: update files';
  const commit = await executeCommand(`git commit -m "${commitMsg}"`, projectDir, 15000);
  if (commit.error) return `Error committing: ${commit.error}`;

  return `Commit: ${commitMsg}\n${diff.stdout.slice(0, 500)}`;
}

export async function gitDiff(projectDir: string): Promise<string> {
  const r = await executeCommand('git diff --stat', projectDir, 10000);
  return r.stdout || r.stderr || 'No changes.';
}

export async function gitLog(projectDir: string, n = 5): Promise<string> {
  const r = await executeCommand(`git log --oneline -${n}`, projectDir, 10000);
  return r.stdout || 'No commits.';
}

export async function gitCreatePR(projectDir: string, title: string, base = 'main'): Promise<string> {
  // Try GitHub CLI
  const r = await executeCommand(`gh pr create --title "${title}" --base "${base}" --fill 2>&1`, projectDir, 15000);
  if (r.error) return `gh CLI no disponible. Crea el PR manualmente.\nTitulo: ${title}\nBase: ${base}`;
  return r.stdout || 'PR creado.';
}

export async function autoCommitAndPush(projectDir: string, message?: string): Promise<string> {
  const commit = await gitAutoCommit(projectDir, message);
  if (commit.includes('Error')) return commit;
  if (commit.includes('No hay cambios')) return commit;

  const push = await executeCommand('git push', projectDir, 15000);
  if (push.error) return `${commit}\nError pushing: ${push.error}`;

  return `${commit}\nPush: OK`;
}
