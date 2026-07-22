// Tool output compression — lightweight RTK-style pipeline

export type CompressionLevel = 'off' | 'minimal' | 'standard' | 'aggressive';

let level: CompressionLevel = 'standard';

export function setCompressionLevel(l: CompressionLevel): void { level = l; }
export function getCompressionLevel(): CompressionLevel { return level; }

// Stats
let totalBytesBefore = 0;
let totalBytesAfter = 0;

export function getStats(): { before: number; after: number; savings: number } {
  return {
    before: totalBytesBefore,
    after: totalBytesAfter,
    savings: totalBytesBefore > 0 ? Math.round((1 - totalBytesAfter / totalBytesBefore) * 100) : 0,
  };
}

// Detect command type from tool call name and output
function detectCommand(toolName: string, output: string): string {
  if (toolName === 'read' || toolName === 'read_file') return 'read';
  if (toolName === 'grep' || toolName === 'search') return 'grep';
  if (toolName === 'bash' || toolName === 'run') {
    if (/^npm\s+(install|ci)\b/m.test(output)) return 'npm-install';
    if (/^npm\s+(test|run)\b/m.test(output)) return 'npm-test';
    if (/^git\s+(status|branch|log|diff)\b/m.test(output)) return 'git';
    if (/^docker\s+(ps|logs|build)\b/m.test(output)) return 'docker';
    if (/^npx\s+(tsc|eslint|prettier)\b/m.test(output)) return 'lint';
    if (/FAIL.*test|Tests.*failed|AssertionError/.test(output)) return 'test-fail';
    if (/^\s*(drwx|total \d)/m.test(output)) return 'ls';
    if (output.length > 2000) return 'bash-long';
    return 'bash';
  }
  return 'generic';
}

// Filters
function compressJson(output: string): string {
  try {
    const parsed = JSON.parse(output);
    const str = JSON.stringify(parsed);
    if (str.length < output.length * 0.6) return str;
  } catch {}
  return output;
}

function compressLines(output: string, maxLines: number): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines + 5) return output;
  const head = lines.slice(0, Math.ceil(maxLines / 2));
  const tail = lines.slice(-Math.floor(maxLines / 2));
  return [...head, `[...${lines.length - maxLines} lines hidden]`, ...tail].join('\n');
}

function dropPatterns(output: string, patterns: RegExp[]): string {
  return output.split('\n').filter(l => !patterns.some(p => p.test(l))).join('\n');
}

function collapseRepeats(output: string): string {
  return output.replace(/^((.+)\n(?:\2\n)+)/gm, (match, block, line) => {
    const count = match.split('\n').length - 1;
    return `${line}\n  [${count - 1} more identical lines]\n`;
  });
}

function summarizeJsonArray(output: string): string {
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return `[${parsed.length} items]${parsed.length > 0 ? '\n' + JSON.stringify(parsed.slice(0, 3), null, 2) + (parsed.length > 3 ? `\n  ... and ${parsed.length - 3} more` : '') : ''}`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      return `{${keys.length} keys}: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? `, ...` : ''}\n` + JSON.stringify(parsed, null, 2).slice(0, 300);
    }
  } catch {}
  return output;
}

function stripAnsi(output: string): string {
  return output.replace(/\x1B\[\d+(;\d+)*m/g, '');
}

function npmInstallFilter(output: string): string {
  const lines = output.split('\n').filter(l =>
    !/^npm (notice|warn|http)/.test(l) &&
    !/^$/.test(l) &&
    !/added|removed|changed|audited/.test(l)
  );
  const summary = lines.filter(l => /^(added|removed|changed|audited|\d+ package)/.test(l));
  return summary.length > 0 ? summary.join('\n') : compressLines(output, 20);
}

function gitFilter(output: string): string {
  return stripAnsi(output).split('\n').filter(l => !/^$\n?$/.test(l)).join('\n');
}

function testOutputFilter(output: string): string {
  const lines = output.split('\n');
  const failing = lines.filter(l => /FAIL|fail|Error|AssertionError|✗|✘/.test(l));
  const passing = lines.filter(l => /PASS|pass|✓|ok/.test(l));
  const summary = lines.filter(l => /Tests:|Test Suites:|passed|failed/.test(l));

  if (failing.length > 0) {
    return ['[TEST OUTPUT — showing failures + summary]', ...failing.slice(0, 20), ...summary.slice(0, 5)].join('\n');
  }
  if (passing.length > 0) {
    return summary.slice(0, 5).join('\n');
  }
  return compressLines(output, 20);
}

function lsFilter(output: string): string {
  const lines = output.trim().split('\n').filter(l => l.trim());
  if (lines.length <= 30) return output;
  return compressLines(output, 24);
}

function bashLongFilter(output: string): string {
  let cleaned = stripAnsi(output);
  cleaned = collapseRepeats(cleaned);
  // Keep error lines, drop progress/status lines
  const lines = cleaned.split('\n');
  const errors = lines.filter(l => /error|Error|ERROR|failed|warning/.test(l));
  if (errors.length > 0) {
    return ['[COMPRESSED — errors preserved]', ...errors.slice(0, 30), `\n[${lines.length - errors.length} non-error lines hidden]`].join('\n');
  }
  return compressLines(cleaned, 40);
}

export function compressOutput(toolName: string, output: string): string {
  if (level === 'off' || !output) return output;

  if (level === 'minimal') {
    // Minimal: just strip ANSI + collapse repeats
    let r = stripAnsi(output);
    r = collapseRepeats(r);
    if (r.length < output.length * 0.9) return r;
    return output;
  }

  const cmd = detectCommand(toolName, output);
  let result = output;

  switch (cmd) {
    case 'npm-install':
      result = npmInstallFilter(result); break;
    case 'npm-test':
      result = testOutputFilter(result); break;
    case 'git':
      result = gitFilter(result); break;
    case 'test-fail':
      result = testOutputFilter(result); break;
    case 'ls':
      result = lsFilter(result); break;
    case 'bash-long':
      result = bashLongFilter(result); break;
    case 'read':
      if (output.startsWith('{') || output.startsWith('[')) result = summarizeJsonArray(result);
      break;
    default:
      result = stripAnsi(result);
      result = collapseRepeats(result);
  }

  // Aggressive: additional truncation
  if (level === 'aggressive') {
    if (result.length > 5000) result = compressLines(result, 60);
    else if (result.length > 2000) result = compressLines(result, 100);
  }

  // Standard truncation for very long output
  if (level === 'standard' && result.length > 8000) {
    result = compressLines(result, 120);
  }

  totalBytesBefore += output.length;
  totalBytesAfter += result.length;

  return result;
}
