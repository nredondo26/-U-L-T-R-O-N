// src/cli/display.ts
// Polished professional CLI visual

import chalk from 'chalk';
import { getTheme, type ThemeName, setTheme as setThemeFn, getThemeName, listThemes } from './theme';

const C = (key: keyof ReturnType<typeof getTheme>) => chalk.hex(getTheme()[key]);

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  public message = '';
  private agent = '';
  private active = false;

  constructor(agent: string, message = '') {
    this.agent = agent;
    this.message = message;
  }

  start(): void {
    if (this.active) return;
    this.active = true; this.frame = 0;
    const label = agentChip(this.agent);
    process.stdout.write(`\n  ${label} `);
    this.interval = setInterval(() => {
      if (!this.active) return;
      const frame = C('primary')(SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length]);
      const msg = this.message ? ` ${C('dim')(this.message)}` : '';
      process.stdout.write(`\r\x1b[K  ${label} ${frame}${msg}`);
      this.frame++;
    }, 80);
  }

  stop(): void {
    this.active = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    process.stdout.write('\r\x1b[K');
  }

  updateMessage(msg: string): void { this.message = msg; }
}

export function resetStreamState(): void {}

export function agentChip(agent: string): string {
  const colors: Record<string, (t: string) => string> = {
    Orchestrator: C('primary'), Editor: C('success'), Librarian: C('warn'),
    Basher: C('accent'), Researcher: C('primary'), Thinker: C('bright'), Reviewer: C('warn'),
  };
  return (colors[agent] || C('dim'))(agent);
}

export function logo(): string {
  const p = C('primary');
  const a = C('accent');
  const w = C('bright');
  const d = C('dim');

  return [
    `    ${p('+')}${p('----------------------------------------------')}${p('+')}`,
    `    ${p('|')}                                              ${p('|')}`,
    `    ${p('|')}              ${w('<> U L T R O N <>')}             ${p('|')}`,
    `    ${p('|')}                                              ${p('|')}`,
    `    ${p('|')}        ${d('Neural Intelligence Platform')}          ${p('|')}`,
    `    ${p('|')}                                              ${p('|')}`,
    `    ${p('|')}   ${a('*')} ${d('Voice')}      ${a('*')} ${d('Vision')}      ${a('*')} ${d('Reasoning')}     ${p('|')}`,
    `    ${p('|')}   ${a('*')} ${d('Memory')}     ${a('*')} ${d('Automation')}  ${a('*')} ${d('Agents')}        ${p('|')}`,
    `    ${p('|')}                                              ${p('|')}`,
    `    ${p('+')}${p('----------------------------------------------')}${p('+')}`,
  ].join('\n');
}

export function welcome(providers: string[], model: string, tokens: number, reqs: number, history: number, theme: string): string {
  const s = C('success');
  const p = C('primary');
  const d = C('dim');
  const dots = providers.length > 0
    ? s('*') + ' ' + providers.map(n => s(n)).join(` ${d('.')} `)
    : C('error')('* no providers');

  return [
    logo(),
    '',
    `  ${d('+')}${d('----------------------------------------------')}${d('+')}`,
    `  ${d('|')}  ${dots}`,
    `  ${d('|')}  ${p(model)} ${d('.')} ${d(theme)} ${d('.')} ${d(tokens.toLocaleString() + ' tokens')} ${history > 0 ? d('. ' + history + ' msgs') : ''}`,
    `  ${d('+')}${d('----------------------------------------------')}${d('+')}`,
    '',
    `  ${d('/help')}  ${d('!cmd')}  ${d('@file')}  ${d('type to start')}`,
    '',
  ].join('\n');
}

export function hr(): string {
  return C('dim')('    ─────────────────────────────────────────────');
}

export function formatAgentAction(agent: string, message: string): string {
  return `    ${agentChip(agent)} ${C('warn')('▸')} ${C('dim')(message)}`;
}

export function formatAgentResult(message: string): string {
  return `      ${C('dim')(message.slice(0, 400))}`;
}

export function formatResponse(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `\n    ${C('dim')(`┌ ${lang || 'code'}`)}\n${code.split('\n').map((l: string) => `    ${C('dim')('│')} ${l}`).join('\n')}\n    ${C('dim')('└─')}`)
    .replace(/`([^`]+)`/g, (_, c) => C('primary')(c))
    .replace(/\*\*(.+?)\*\*/g, (_, t) => C('bright')(t));
}

export function formatSlashResponse(text: string): string {
  return text.split('\n').map(l => `    ${l}`).join('\n');
}

export function promptText(): string {
  return `${C('primary')('▸')} `;
}

export function promptModel(): string {
  return `${C('warn')('▸ model')} `;
}

export interface SelectOption { label: string; value: string; group?: string; }

export function printSelectMenu(title: string, options: SelectOption[], currentValue?: string): number {
  let out = `\n    ${C('bright')(title)}\n`;
  let currentGroup = ''; let num = 0;
  for (const opt of options) {
    if (opt.group && opt.group !== currentGroup) { currentGroup = opt.group; out += `\n    ${C('dim')(currentGroup)}\n`; }
    num++;
    const active = opt.value === currentValue;
    out += `    ${active ? C('success')('●') : C('dim')('○')} ${String(num).padStart(2, ' ')} ${active ? C('success')(opt.label) : opt.label}\n`;
  }
  out += `\n    ${C('dim')(`1-${num} to select`)}`;
  process.stdout.write(out + '\n');
  return options.length;
}

export function showTokens(tokens: number, requests: number): string {
  return C('dim')(`${tokens.toLocaleString()} tokens · ${requests} reqs`);
}

export function footer(tokens: number, requests: number, model: string): string {
  return `    ${C('dim')('─'.repeat(45))}\n    ${C('dim')(`${model}  ·  ${tokens.toLocaleString()} tokens  ·  ${requests} reqs`)}\n`;
}

export { setThemeFn as setTheme, getThemeName, listThemes };
