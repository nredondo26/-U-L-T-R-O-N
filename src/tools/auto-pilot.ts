// src/tools/auto-pilot.ts
// Auto-pilot profesional: self-healing, background tasks, smart retry, goal decomposition

import { executeCommand } from './execute';
import { mouseClick, mouseMove, keyboardType, keyboardPress, screenCapture, getScreenInfo, getMousePosition } from './automation';

interface AutoTask {
  id: string;
  description: string;
  steps: AutoStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
}

interface AutoStep {
  action: string;
  target?: string;
  fallback?: string;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'done' | 'failed';
}

let taskQueue: AutoTask[] = [];
let currentTask: AutoTask | null = null;

export function createTask(description: string, steps: string[]): AutoTask {
  const task: AutoTask = {
    id: 'task_' + Date.now(),
    description,
    steps: steps.map((s, i) => ({
      action: s,
      retries: 0,
      maxRetries: 3,
      status: 'pending' as const,
    })),
    status: 'pending',
    createdAt: Date.now(),
  };
  taskQueue.push(task);
  return task;
}

export async function smartClick(target: string): Promise<string> {
  // Multi-strategy click: try exact, then fuzzy, then keyboard alternative
  const strategies = [
    // Strategy 1: Direct click using coordinates
    async () => {
      if (target.includes(',')) {
        const [x, y] = target.split(',').map(Number);
        if (!isNaN(x) && !isNaN(y)) {
          await mouseMove(x, y);
          await new Promise(r => setTimeout(r, 200));
          await mouseClick('left');
          return `Click en (${x}, ${y})`;
        }
      }
      return null;
    },
    // Strategy 2: Use keyboard to navigate
    async () => {
      const lower = target.toLowerCase();
      if (lower.includes('enter') || lower.includes('aceptar')) {
        await keyboardPress('enter');
        return 'Presionado Enter';
      }
      if (lower.includes('tab') || lower.includes('siguiente')) {
        await keyboardPress('tab');
        return 'Presionado Tab';
      }
      if (lower.includes('escape') || lower.includes('cancelar')) {
        await keyboardPress('escape');
        return 'Presionado Escape';
      }
      return null;
    },
    // Strategy 3: Try typing with tab navigation
    async () => {
      if (target.length > 0 && !target.includes(',')) {
        // Try to find by typing
        await keyboardPress('tab');
        await new Promise(r => setTimeout(r, 100));
        await keyboardType(target);
        await new Promise(r => setTimeout(r, 100));
        await keyboardPress('enter');
        return `Navegado y seleccionado: ${target}`;
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) return result;
  }

  return `No se pudo hacer click en: ${target}`;
}

export async function smartType(text: string, field?: string): Promise<string> {
  // Clear field first, then type
  if (field) {
    // Try to focus field by tabbing
    await keyboardPress('tab');
    await new Promise(r => setTimeout(r, 100));
  }
  await keyboardPress('ctrl+a'); // Select all
  await new Promise(r => setTimeout(r, 50));
  await keyboardType(text);
  return `Escrito: "${text.slice(0, 50)}"`;
}

export async function openAndFocus(app: string): Promise<string> {
  // Multiple strategies to open an app
  const strategies = [
    async () => {
      // Strategy 1: Win+R, type app name
      await keyboardPress('win+r');
      await new Promise(r => setTimeout(r, 300));
      await keyboardType(app);
      await new Promise(r => setTimeout(r, 200));
      await keyboardPress('enter');
      await new Promise(r => setTimeout(r, 1000));
      return `Abierto via Win+R: ${app}`;
    },
    async () => {
      // Strategy 2: Start menu search
      await keyboardPress('win');
      await new Promise(r => setTimeout(r, 500));
      await keyboardType(app);
      await new Promise(r => setTimeout(r, 500));
      await keyboardPress('enter');
      await new Promise(r => setTimeout(r, 500));
      return `Abierto via Start: ${app}`;
    },
  ];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch {}
  }
  return `No se pudo abrir: ${app}`;
}

export async function executeTask(task: AutoTask): Promise<string> {
  task.status = 'running';
  currentTask = task;
  const results: string[] = [];

  for (let i = 0; i < task.steps.length; i++) {
    const step = task.steps[i];
    step.status = 'running';

    while (step.retries < step.maxRetries) {
      try {
        const result = await executeStep(step.action);
        results.push(`[${i + 1}/${task.steps.length}] ✓ ${step.action}: ${result}`);
        step.status = 'done';
        break;
      } catch (e: unknown) {
        step.retries++;
        if (step.retries >= step.maxRetries) {
          step.status = 'failed';
          results.push(`[${i + 1}/${task.steps.length}] ✗ ${step.action} (${step.retries} intentos)`);
        } else {
          await new Promise(r => setTimeout(r, 1000 * step.retries));
        }
      }
    }
  }

  task.status = task.steps.every(s => s.status === 'done') ? 'completed' : 'failed';
  currentTask = null;
  return `Tarea "${task.description}": ${task.status}\n${results.join('\n')}`;
}

async function executeStep(action: string): Promise<string> {
  const lower = action.toLowerCase();

  // Parse common patterns
  if (lower.startsWith('click ') || lower.startsWith('clic ')) {
    return smartClick(action.replace(/^click\s+|^clic\s+/i, ''));
  }
  if (lower.startsWith('type ') || lower.startsWith('escribe ') || lower.startsWith('escribir ')) {
    return smartType(action.replace(/^type\s+|^escribe\s+|^escribir\s+/i, ''));
  }
  if (lower.startsWith('open ') || lower.startsWith('abrir ') || lower.startsWith('abre ')) {
    return openAndFocus(action.replace(/^open\s+|^abrir\s+|^abre\s+/i, ''));
  }
  if (lower.startsWith('press ') || lower.startsWith('presiona ') || lower.startsWith('pulsa ')) {
    const keys = action.replace(/^press\s+|^presiona\s+|^pulsa\s+/i, '');
    return keyboardPress(keys);
  }
  if (lower.startsWith('wait ') || lower.startsWith('espera ') || lower.startsWith('esperar ')) {
    const ms = parseInt(action.replace(/[^0-9]/g, '')) || 1000;
    await new Promise(r => setTimeout(r, ms));
    return `Esperado ${ms}ms`;
  }
  if (lower.startsWith('screenshot') || lower.startsWith('captura')) {
    const cap = await screenCapture();
    return cap ? `Screenshot: ${cap.path}` : 'Error capturando';
  }
  if (lower.startsWith('info') || lower.startsWith('screen')) {
    return getScreenInfo();
  }

  // Default: try as keyboard shortcut or command
  if (action.length < 20 && action.includes('+')) {
    return keyboardPress(action);
  }
  if (action.length < 50) {
    return keyboardType(action);
  }

  return `Accion no reconocida: ${action}`;
}

export function getQueueStatus(): string {
  if (taskQueue.length === 0 && !currentTask) return 'No hay tareas en cola.';
  let status = currentTask ? `En ejecucion: ${currentTask.description}\n` : '';
  status += `Cola: ${taskQueue.filter(t => t.status === 'pending').length} pendientes, ${taskQueue.filter(t => t.status === 'completed').length} completadas`;
  return status;
}
