// src/cli/commands.ts
// Comandos slash de la CLI

export function isCommand(input: string): boolean {
  return input.startsWith('/');
}

export function parseCommand(input: string): { command: string; args: string } {
  const space = input.indexOf(' ');
  if (space === -1) return { command: input.slice(1).toLowerCase(), args: '' };
  return {
    command: input.slice(1, space).toLowerCase(),
    args: input.slice(space + 1).trim(),
  };
}

export const COMMAND_HELP: Record<string, string> = {
  help: 'Muestra esta ayuda',
  new: 'Inicia una nueva conversacion',
  history: 'Muestra el historial de la sesion',
  models: 'Lista los modelos LLM disponibles',
  vault: 'Muestra notas del vault Obsidian',
  'vault:search': 'Busca notas en el vault. Uso: /vault:search <terminos>',
  status: 'Estado del sistema',
  bash: 'Modo bash: ejecuta comandos directamente',
  plan: 'Solicita un plan del Thinker para una tarea. Uso: /plan <tarea>',
  exit: 'Sale de J.A.R.V.I.S.',
};
