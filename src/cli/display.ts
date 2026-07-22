// src/cli/display.ts
// Professional CLI visual — clean, minimal, like OpenCode

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
  private startTime = 0;

  constructor(agent: string, message = '') {
    this.agent = agent;
    this.message = message;
  }

  start(): void {
    if (this.active) return;
    this.active = true; this.frame = 0; this.startTime = Date.now();
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }

  private render(): void {
    if (!this.active) return;
    const frame = C('accent')(SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length]);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const agent = C('dim')(this.agent);
    const msg = this.message ? ` ${C('dim')(this.message.slice(0, 60))}` : '';
    process.stdout.write(`\r\x1b[K  ${frame} ${agent} ${C('dim')(elapsed + 's')}${msg}`);
    this.frame++;
  }

  stop(): void {
    this.active = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    process.stdout.write('\r\x1b[K');
  }

  updateMessage(msg: string): void { this.message = msg; }
}

export function resetStreamState(): void {}

const DISPLAY_NAMES: Record<string, string> = {
  Orchestrator: 'Cerebro', Architect: 'Visión', Editor: 'Artífice',
  Librarian: 'Sabio', Basher: 'Ejecutor', Researcher: 'Explorador',
  Thinker: 'Estratega', Reviewer: 'Juez',
};

export function agentChip(agent: string): string {
  const colors: Record<string, (t: string) => string> = {
    Orchestrator: C('primary'), Editor: C('success'), Librarian: C('warn'),
    Basher: C('accent'), Researcher: C('primary'), Thinker: C('bright'), Reviewer: C('warn'),
  };
  return (colors[agent] || C('dim'))(DISPLAY_NAMES[agent] || agent);
}

export function logo(): string {
  const d = C('dim');
  return [
    `  ${d('┌─────────────────────────────────────────────┐')}`,
    `  ${d('│')}             ${C('bright')('U L T R O N')}               ${d('│')}`,
    `  ${d('│')}        ${d('Neural Intelligence Platform')}          ${d('│')}`,
    `  ${d('└─────────────────────────────────────────────┘')}`,
  ].join('\n');
}

export function welcome(providers: string[], model: string, tokens: number, reqs: number, history: number, theme: string): string {
  const s = C('success');
  const d = C('dim');
  const p = C('primary');
  const dots = providers.length > 0
    ? providers.map(n => s(n)).join(` ${d('.')} `)
    : C('error')('no providers');

  return [
    logo(),
    '',
    `  ${d('providers')}  ${dots}`,
    `  ${d('model')}     ${p(model)}`,
    `  ${d('theme')}     ${d(theme)}`,
    ...(history > 0 ? [`  ${d('history')}  ${d(history + ' messages')}`] : []),
    '',
    `  ${d('type')} a message  ${d('/help')} for commands  ${d('!cmd')} to run  ${d('@file')} to read`,
    '',
  ].join('\n');
}

export function hr(): string {
  return C('dim')('  ─────────────────────────────────────────────');
}

export function formatResponse(text: string): string {
  const d = C('dim');
  const p = C('primary');
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const lines = code.split('\n');
      const langTag = lang ? ` ${lang}` : '';
      const header = `\n  ${d(`┌${'─'.repeat(50)}`)}${p(langTag)}`;
      const body = lines.map((l: string) => `  ${d('│')} ${l}`).join('\n');
      const footer = `\n  ${d(`└${'─'.repeat(50)}`)}`;
      return `${header}\n${body}${footer}`;
    })
    .replace(/`([^`]+)`/g, (_, c) => C('primary')(c))
    .replace(/\*\*(.+?)\*\*/g, (_, t) => C('bright')(t));
}

export function formatSlashResponse(text: string): string {
  return text.split('\n').map(l => `  ${l}`).join('\n');
}

export function promptText(): string {
  return `${C('accent')('>')} `;
}

export function promptModel(): string {
  return `${C('warn')('> model')} `;
}

export interface SelectOption { label: string; value: string; group?: string; }

export function printSelectMenu(title: string, options: SelectOption[], currentValue?: string): number {
  let out = `\n  ${C('bright')(title)}\n`;
  let currentGroup = ''; let num = 0;
  for (const opt of options) {
    if (opt.group && opt.group !== currentGroup) { currentGroup = opt.group; out += `\n  ${C('dim')(currentGroup)}\n`; }
    num++;
    const active = opt.value === currentValue;
    out += `  ${active ? C('success')('●') : C('dim')('○')} ${String(num).padStart(2, ' ')} ${active ? C('success')(opt.label) : opt.label}\n`;
  }
  out += `\n  ${C('dim')(`enter 1-${num} to select`)}`;
  process.stdout.write(out + '\n');
  return options.length;
}

export function showTokens(tokens: number, requests: number): string {
  return C('dim')(`${tokens.toLocaleString()} tokens · ${requests} reqs`);
}

export function footer(tokens: number, requests: number, model: string): string {
  return `  ${C('dim')('─'.repeat(50))}\n  ${C('dim')(`${model}  ·  ${tokens.toLocaleString()} tokens  ·  ${requests} reqs`)}\n`;
}

export { setThemeFn as setTheme, getThemeName, listThemes };
