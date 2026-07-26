import * as path from 'path';
import * as os from 'os';

const SYSTEM_DIRS: string[] = [
  process.env.WINDIR || 'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  'C:\\System Volume Information',
  'C:\\$Recycle.Bin',
  'C:\\Recovery',
  'C:\\Documents and Settings',
];

const USER_HOME = os.homedir().toLowerCase();

export function isSystemDir(filePath: string): boolean {
  const resolved = path.resolve(filePath).toLowerCase();
  for (const dir of SYSTEM_DIRS) {
    const d = dir.toLowerCase();
    if (resolved === d || resolved.startsWith(d + '\\') || resolved.startsWith(d + '/')) return true;
    // Also block root of system drive (C:\) itself
    if (resolved === 'c:\\' || resolved === 'c:') {
      // But allow C:\Users, C:\Temp, etc.
      return false;
    }
  }
  return false;
}

export function isUserDir(filePath: string): boolean {
  const resolved = path.resolve(filePath).toLowerCase();
  return resolved.startsWith(USER_HOME) ||
         resolved.startsWith(path.join(os.homedir(), '..').toLowerCase()) ||
         resolved.match(/^[a-z]:\\users\b/i) !== null;
}

export function checkAccess(filePath: string): { allowed: boolean; reason?: string } {
  const resolved = path.resolve(filePath).toLowerCase();

  // Special system dirs - ALWAYS blocked
  for (const dir of SYSTEM_DIRS) {
    const d = dir.toLowerCase();
    if (resolved === d || resolved.startsWith(d + '\\') || resolved.startsWith(d + '/')) {
      return { allowed: false, reason: `Access denied: ${resolved} is a protected system directory` };
    }
  }

  // User directories - ALWAYS allowed (Downloads, Documents, Desktop, AppData, Temp, etc.)
  if (isUserDir(resolved)) {
    return { allowed: true };
  }

  // Other drives (D:, E:, network shares) - allowed
  if (!resolved.startsWith('c:\\')) {
    return { allowed: true };
  }

  // C:\ root - allowed, C:\Temp - allowed, C:\anything else user - allowed
  // Only C:\Windows, C:\Program Files, etc. are blocked (checked above)
  return { allowed: true };
}

export function resolvePath(filePath: string, projectDir: string): { resolved: string; error?: string } {
  const resolved = path.resolve(projectDir, filePath);
  const access = checkAccess(resolved);
  if (!access.allowed) {
    return { resolved, error: access.reason || `Access denied: ${resolved}` };
  }
  return { resolved };
}
