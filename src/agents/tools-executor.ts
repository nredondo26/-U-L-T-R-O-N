// src/agents/tools-executor.ts
// Ejecucion de herramientas con retry y paralelizacion

import type { ToolCall } from '../shared/types';
import type { AgentResult } from './types';
import * as fileTools from '../tools/file';
import { executeCommand } from '../tools/execute';
import { webSearch } from '../tools/web';
import { analyzeDocument } from '../tools/document';
import { fastSearch } from '../tools/search';
import { speak } from '../tools/voice';
import { mouseClick, mouseMove, keyboardType, keyboardPress, screenCapture, getScreenInfo } from '../tools/automation';
import { createTask, executeTask, smartClick, smartType, openAndFocus, getQueueStatus } from '../tools/auto-pilot';
import { saveToDesktop, saveToFile, checkFile, getDesktopPath } from '../tools/file-ops';
import { execSync } from 'child_process';
import { EditorAgent } from './editor';
import { LibrarianAgent } from './librarian';
import { BasherAgent } from './basher';
import { ResearcherAgent } from './researcher';
import { ThinkerAgent } from './thinker';
import { ReviewerAgent } from './reviewer';
import { ArchitectAgent } from './architect';

const MAX_RETRIES = 2;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  projectDir: string,
  editor?: EditorAgent,
  librarian?: LibrarianAgent,
  basher?: BasherAgent,
  researcher?: ResearcherAgent,
  thinker?: ThinkerAgent,
  reviewer?: ReviewerAgent,
  architect?: ArchitectAgent,
): Promise<{ result: string; retries: number }> {
  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executeToolOnce(
        name, args, projectDir,
        editor, librarian, basher, researcher, thinker, reviewer, architect,
      );
      return { result, retries: attempt };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return { result: `Error (${MAX_RETRIES + 1} intentos): ${lastError}`, retries: MAX_RETRIES };
}

async function executeToolOnce(
  name: string,
  args: Record<string, unknown>,
  projectDir: string,
  editor?: EditorAgent,
  librarian?: LibrarianAgent,
  basher?: BasherAgent,
  researcher?: ResearcherAgent,
  thinker?: ThinkerAgent,
  reviewer?: ReviewerAgent,
  architect?: ArchitectAgent,
): Promise<string> {
  switch (name) {
    case 'delegate_editor': {
      if (!editor) throw new Error('Editor no disponible');
      const result = await editor.run(args.task as string);
      return result.content;
    }
    case 'delegate_librarian': {
      if (!librarian) throw new Error('Librarian no disponible');
      const result = await librarian.run(args.task as string);
      return result.content;
    }
    case 'delegate_basher': {
      if (!basher) throw new Error('Basher no disponible');
      const result = await basher.run(args.task as string);
      return result.content;
    }
    case 'delegate_researcher': {
      if (!researcher) throw new Error('Researcher no disponible');
      const result = await researcher.run(args.task as string);
      return result.content;
    }
    case 'delegate_thinker': {
      if (!thinker) throw new Error('Thinker no disponible');
      const plan = await thinker.plan(args.task as string);
      const steps = plan.steps.map(s => `- [${s.agent}] ${s.description}`).join('\n');
      return `PLAN: ${plan.summary}\n\nPASOS:\n${steps}`;
    }
    case 'delegate_reviewer': {
      if (!reviewer) throw new Error('Reviewer no disponible');
      return reviewer.review(args.content as string, args.context as string | undefined);
    }
    case 'delegate_architect': {
      if (!architect) throw new Error('Architect no disponible');
      const plan = await architect.createPlan(args.task as string || '');
      return architect.formatPlan(plan);
    }
    case 'vault_save':
      return `Nota "${args.name}" lista para guardar.`;
    case 'direct_execute': {
      const result = await executeCommand(args.command as string, projectDir);
      return `STDOUT:\n${result.stdout || '(vacio)'}\nSTDERR:\n${result.stderr || '(ninguno)'}\nEXIT: ${result.code}`;
    }
    case 'direct_search':
      return webSearch(args.query as string);
    case 'read_file': {
      try {
        const content = fileTools.readFile(args.filePath as string, projectDir);
        return content.slice(0, 6000);
      } catch (e: unknown) {
        return 'Error: ' + (e instanceof Error ? e.message : String(e));
      }
    }
    case 'write_file': {
      try {
        fileTools.writeFile(args.filePath as string, args.content as string, projectDir);
        return `Archivo creado: ${args.filePath}`;
      } catch (e: unknown) {
        return 'Error: ' + (e instanceof Error ? e.message : String(e));
      }
    }
    case 'grep': {
      const results = fastSearch(args.query as string, projectDir, args.filePattern as string | undefined);
      if (results.length === 0) return 'No encontrado.';
      return results.map(r => `${r.file}:${r.line}: ${r.content}`).join('\n');
    }
    case 'str_replace': {
      try {
        const filePath = args.filePath as string;
        const oldStr = args.old_str as string;
        const newStr = args.new_str as string;
        const content = fileTools.readFile(filePath, projectDir);

        // Exact match
        if (content.includes(oldStr)) {
          fileTools.writeFile(filePath, content.replace(oldStr, newStr), projectDir);
          return `Reemplazo exitoso en ${filePath}`;
        }

        // Fuzzy match: try line-by-line
        const oldLines = oldStr.trim().split('\n');
        const contentLines = content.split('\n');
        let found = false;

        for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
          const chunk = contentLines.slice(i, i + oldLines.length).join('\n');
          const similarity = linesSimilarity(chunk, oldStr.trim());
          if (similarity > 0.7) {
            contentLines.splice(i, oldLines.length, ...newStr.split('\n'));
            fileTools.writeFile(filePath, contentLines.join('\n'), projectDir);
            return `Reemplazo fuzzy (${Math.round(similarity * 100)}% match) en ${filePath}:${i + 1}`;
          }
        }

        return `No se encontro "${oldStr.slice(0, 80)}..." en ${filePath}. Revisa el texto exacto.`;
      } catch (e: unknown) {
        return 'Error: ' + (e instanceof Error ? e.message : String(e));
      }
    }
    case 'run_lint': {
      try {
        execSync('npx tsc --noEmit 2>&1', { cwd: projectDir, timeout: 30000, encoding: 'utf8' });
        return 'Lint/typecheck: OK (sin errores)';
      } catch (e: unknown) {
        const out = (e as { stdout?: string; stderr?: string }).stdout || (e as { message?: string }).message || '';
        return 'Lint/typecheck errors:\n' + (typeof out === 'string' ? out.slice(0, 3000) : '');
      }
    }
    case 'speak': {
      return speak(args.text as string, args.voice as string | undefined);
    }
    case 'mouse_click': {
      return mouseClick(args.button as string || 'left');
    }
    case 'mouse_move': {
      return mouseMove(args.x as number, args.y as number);
    }
    case 'keyboard_type': {
      return keyboardType(args.text as string);
    }
    case 'keyboard_press': {
      return keyboardPress(args.keys as string);
    }
    case 'screen_capture': {
      const cap = await screenCapture();
      if (!cap) return 'Error al capturar pantalla.';
      return `Pantalla capturada: ${cap.path} (${Math.round(cap.base64.length / 1024)}KB)`;
    }
    case 'screen_info': {
      return getScreenInfo();
    }
    case 'smart_click': {
      return smartClick(args.target as string);
    }
    case 'smart_type': {
      return smartType(args.text as string, args.field as string | undefined);
    }
    case 'open_focus': {
      return openAndFocus(args.app as string);
    }
    case 'queue_status': {
      return getQueueStatus();
    }
    case 'run_task': {
      const steps = (args.steps as string[]).map(String);
      const task = createTask(args.description as string, steps);
      return executeTask(task);
    }
    case 'save_desktop': {
      return saveToDesktop(args.filename as string, args.content as string);
    }
    case 'save_file': {
      return saveToFile(args.path as string, args.content as string);
    }
    case 'check_file': {
      return checkFile(args.path as string);
    }
    case 'desktop_path': {
      return getDesktopPath();
    }
    case 'browse_url': {
      await executeCommand(
        process.platform === 'win32' ? `start "" "${args.url}"` : `open "${args.url}"`,
        projectDir,
      );
      return `Navegador abierto: ${args.url}`;
    }
    case 'open_app': {
      await executeCommand(
        process.platform === 'win32' ? `start "" "${args.app}"` : `open "${args.app}"`,
        projectDir,
      );
      return `Aplicacion abierta: ${args.app}`;
    }
    case 'analyze_document': {
      const result = await analyzeDocument(args.filePath as string);
      if (!result.success) return result.error || 'Error al analizar documento.';
      return `[${result.fileType.toUpperCase()}] ${result.fileName} (${result.charCount.toLocaleString()} caracteres${result.pageCount ? `, ${result.pageCount} paginas` : ''}${result.sheetCount ? `, ${result.sheetCount} hojas` : ''})\n\n${result.content.slice(0, 8000)}`;
    }
    default:
      return `Herramienta desconocida: ${name}`;
  }
}

function linesSimilarity(a: string, b: string): number {
  const al = new Set(a.toLowerCase().split(/\s+/));
  const bl = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...al].filter(x => bl.has(x)));
  return intersection.size / Math.max(al.size, bl.size, 1);
}

export async function executeToolsParallel(
  toolCalls: ToolCall[],
  executor: (name: string, args: Record<string, unknown>) => Promise<{ result: string; retries: number }>,
): Promise<Array<{ tool_call_id: string; content: string; retries: number }>> {
  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      const { result, retries } = await executor(tc.function.name, args);
      return { tool_call_id: tc.id, content: result, retries };
    }),
  );
  return results;
}
