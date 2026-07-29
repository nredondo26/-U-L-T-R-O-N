import * as fs from 'fs';
import * as path from 'path';
import { executeCommand } from './execute';
import { readFile } from './file';

export type EvidenceState = 'prepared' | 'observed' | 'verified' | 'failed';

export interface EvidenceRecord {
  id: string;
  type: 'file_write' | 'file_replace' | 'command' | 'agent_task';
  description: string;
  state: EvidenceState;
  details: string;
  timestamp: number;
  filePath?: string;
}

const records: EvidenceRecord[] = [];

function newId(): string {
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getEvidenceLog(limit = 20): EvidenceRecord[] {
  return records.slice(-limit);
}

export function recordEvidence(type: EvidenceRecord['type'], description: string, state: EvidenceState, details: string, filePath?: string): EvidenceRecord {
  const r: EvidenceRecord = { id: newId(), type, description, state, details, timestamp: Date.now(), filePath };
  records.push(r);
  if (records.length > 100) records.splice(0, records.length - 100);
  return r;
}

export async function verifyFileWritten(filePath: string, projectDir: string, expectedContent?: string): Promise<EvidenceRecord> {
  const fullPath = path.resolve(projectDir, filePath);
  const desc = `Verificar archivo: ${filePath}`;
  try {
    if (!fs.existsSync(fullPath)) {
      return recordEvidence('file_write', desc, 'failed', `Archivo no encontrado: ${fullPath}`, filePath);
    }
    const stat = fs.statSync(fullPath);
    if (expectedContent !== undefined) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content === expectedContent) {
        return recordEvidence('file_write', desc, 'verified', `OK (${stat.size} bytes, contenido coincide)`, filePath);
      } else {
        return recordEvidence('file_write', desc, 'failed', `Contenido no coincide (esperado ${expectedContent.length} chars, real ${content.length} chars)`, filePath);
      }
    }
    return recordEvidence('file_write', desc, 'verified', `OK (${stat.size} bytes, ${stat.size > 0 ? 'no vacío' : 'VACÍO'})`, filePath);
  } catch (e: unknown) {
    return recordEvidence('file_write', desc, 'failed', `Error: ${e instanceof Error ? e.message : String(e)}`, filePath);
  }
}

export async function verifyCommand(command: string, cwd: string, expectedExitCode = 0): Promise<EvidenceRecord> {
  const desc = `Verificar comando: ${command.slice(0, 60)}`;
  try {
    const result = await executeCommand(command, cwd, 15000);
    const code = result.code ?? -1;
    if (code === expectedExitCode) {
      return recordEvidence('command', desc, 'verified', `Exit code: ${code}${result.stdout ? ` | Output: ${result.stdout.slice(0, 100)}` : ''}`);
    } else {
      return recordEvidence('command', desc, 'failed', `Exit code esperado: ${expectedExitCode}, real: ${code}. Error: ${(result.stderr || '').slice(0, 100)}`);
    }
  } catch (e: unknown) {
    return recordEvidence('command', desc, 'failed', `Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function verifyStrReplace(filePath: string, oldStr: string, newStr: string, projectDir: string): Promise<EvidenceRecord> {
  const desc = `Verificar reemplazo en: ${filePath}`;
  try {
    const content = readFile(filePath, projectDir);
    if (content.includes(newStr) && !content.includes(oldStr)) {
      return recordEvidence('file_replace', desc, 'verified', `Reemplazo exitoso. oldStr eliminado, newStr presente.`);
    } else if (content.includes(oldStr)) {
      return recordEvidence('file_replace', desc, 'failed', `El texto antiguo aún está presente.`, filePath);
    } else {
      return recordEvidence('file_replace', desc, 'observed', `Archivo modificado pero no se pudo confirmar el reemplazo exacto.`, filePath);
    }
  } catch (e: unknown) {
    return recordEvidence('file_replace', desc, 'failed', `Error: ${e instanceof Error ? e.message : String(e)}`, filePath);
  }
}

export function evidenceSummary(): string {
  const total = records.length;
  const verified = records.filter(r => r.state === 'verified').length;
  const failed = records.filter(r => r.state === 'failed').length;
  const recent = records.slice(-5);
  return [
    `Evidence Gates: ${verified}/${total} verified, ${failed} failed`,
    ...recent.map(r => `  [${r.state}] ${r.description.slice(0, 60)}`),
  ].join('\n');
}
