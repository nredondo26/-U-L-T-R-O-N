import chalk from 'chalk';
import { getTheme, type ThemeName, setTheme as setThemeFn, getThemeName, listThemes } from './theme';

const C = (key: keyof ReturnType<typeof getTheme>) => chalk.hex(getTheme()[key]);

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DOT_FRAMES = ['  ', '. ', '..', '...'];

export class Spinner {
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  public message = '';
  private agent = '';
  private active = false;
  private startTime = 0;
  private dotPhase = 0;

  constructor(agent: string, message = '') {
    this.agent = agent;
    this.message = message;
  }

  start(): void {
    if (this.active) return;
    this.active = true; this.frame = 0; this.startTime = Date.now();
    this.render();
    this.interval = setInterval(() => this.render(), 100);
  }

  private render(): void {
    if (!this.active) return;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const frame = C('accent')(SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length]);
    const dots = DOT_FRAMES[this.dotPhase % DOT_FRAMES.length];
    const agent = C('accent')(this.agent);
    const msg = this.message ? ` ${C('dim')(this.message.slice(0, 50))}` : '';
    const time = C('dim')(elapsed + 's');
    process.stdout.write(`\r\x1b[K  ${frame}  ${agent}${msg}  ${time}`);
    this.frame++;
    this.dotPhase = Math.floor(this.frame / 3) % DOT_FRAMES.length;
  }

  stop(): void {
    this.active = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    process.stdout.write('\r\x1b[K');
  }

  updateMessage(msg: string): void { this.message = msg; }
}

let spinnerActive = false;

export function setSpinnerState(active: boolean): void {
  spinnerActive = active;
}

export function resetStreamState(): void {}

const DISPLAY_NAMES: Record<string, string> = {
  Orchestrator: 'Cerebro', Architect: 'Visión', Editor: 'Artífice',
  Librarian: 'Sabio', Basher: 'Ejecutor', Researcher: 'Explorador',
  Thinker: 'Estratega', Reviewer: 'Juez',
};

export function agentChip(agent: string): string {
  const colors: Record<string, (t: string) => string> = {
    Orchestrator: C('accent'), Editor: C('success'), Librarian: C('warn'),
    Basher: C('primary'), Researcher: C('accent'), Thinker: C('warn'), Reviewer: C('error'),
  };
  return (colors[agent] || C('dim'))(DISPLAY_NAMES[agent] || agent);
}

export function welcome(providers: string[], model: string, tokens: number, reqs: number, history: number, theme: string): string {
  const a = C('accent');
  const d = C('dim');
  const p = C('primary');
  const dots = providers.length > 0
    ? providers.map(n => d(n)).join(` ${d('·')} `)
    : d('none');

  return [
    `  ${a('◆')} ${p('ULTRON')} ${d('v5')}`,
    `  ${d('model')} ${a(model)}  ${d('tokens')} ${a(tokens.toLocaleString())}`,
    '',
    `  ${d('type a message · /help · !cmd · @file')}`,
    '',
  ].join('\n');
}

export function hr(): string {
  return C('dim')('  ─────────────────────────────────────────────────');
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
    .replace(/`([^`]+)`/g, (_, c) => C('accent')(c))
    .replace(/\*\*(.+?)\*\*/g, (_, t) => C('bright')(t));
}

export function formatSlashResponse(text: string): string {
  return text.split('\n').map(l => `  ${l}`).join('\n');
}

export function promptText(): string {
  return `${C('accent')('◆')} `;
}

export function promptModel(): string {
  return `${C('warn')('◆ model')} `;
}

export interface SelectOption { label: string; value: string; group?: string; }

export function printSelectMenu(title: string, options: SelectOption[], currentValue?: string): number {
  let out = `\n  ${C('bright')(title)}\n`;
  let currentGroup = ''; let num = 0;
  for (const opt of options) {
    if (opt.group && opt.group !== currentGroup) { currentGroup = opt.group; out += `\n  ${C('dim')(currentGroup)}\n`; }
    num++;
    const active = opt.value === currentValue;
    out += `  ${active ? C('accent')('◆') : C('dim')('◇')} ${C('dim')(String(num).padStart(2, ' '))} ${active ? C('accent')(opt.label) : opt.label}\n`;
  }
  out += `\n  ${C('dim')(`enter 1-${num} to select`)}`;
  process.stdout.write(out + '\n');
  return options.length;
}

export function showTokens(tokens: number, requests: number): string {
  return C('dim')(`${tokens.toLocaleString()} tokens · ${requests} reqs`);
}

export function footer(tokens: number, requests: number, model: string): string {
  return `  ${C('dim')('─'.repeat(50))}\n  ${C('dim')(`${model}`)} ${C('dim')('·')} ${C('dim')(`${tokens.toLocaleString()} tokens`)} ${C('dim')('·')} ${C('dim')(`${requests} reqs`)}\n`;
}

export { setThemeFn as setTheme, getThemeName, listThemes };
