import { executeCommand } from './execute';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function mouseClick(button = 'left'): Promise<string> {
  if (process.platform !== 'win32') return 'OK (not Windows)';
  try {
    const flags = button === 'right' ? '0x08,0,0,0,0); $m::mouse_event(0x10,0,0,0,0' : '0x02,0,0,0,0); $m::mouse_event(0x04,0,0,0,0';
    const ps = `Add-Type -Name M -MemberDefinition '[DllImport("user32.dll")]public static extern void mouse_event(int f,int x,int y,int d,int e);' -PassThru; $m=[M]; $m::mouse_event(${flags}); 'ok'`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 3000);
    if (r.error) return `ERROR: ${r.error}`;
  } catch (e: unknown) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; }
  return 'OK';
}

export async function mouseMove(x: number, y: number): Promise<string> {
  if (process.platform !== 'win32') return 'OK (not Windows)';
  try {
    const ps = `Add-Type -Name MP -MemberDefinition '[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);' -PassThru; [MP]::SetCursorPos(${x},${y}); 'ok'`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 3000);
    if (r.error) return `ERROR: ${r.error}`;
  } catch (e: unknown) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; }
  return 'OK';
}

export async function keyboardType(text: string): Promise<string> {
  if (process.platform !== 'win32') return 'OK (not Windows)';
  const safe = text.replace(/['"{}$~+^%()]/g, '').slice(0, 200);
  try {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safe}'); 'ok'`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 5000);
    if (r.error) return `ERROR: ${r.error}`;
  } catch (e: unknown) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; }
  return 'OK';
}

export async function keyboardPress(keys: string): Promise<string> {
  if (process.platform !== 'win32') return 'OK (not Windows)';
  const safe = keys.replace(/[{}]/g, '');
  try {
    if (safe.toLowerCase().startsWith('ctrl+') && safe.length === 6) {
      const code = safe[5].toUpperCase().charCodeAt(0);
      const ps = `Add-Type -Name KB -MemberDefinition '[DllImport("user32.dll")]public static extern void keybd_event(byte v,byte s,uint f,UIntPtr x);' -PassThru; $k=[KB];$k::keybd_event(0x11,0,0,0);$k::keybd_event(${code},0,0,0);$k::keybd_event(${code},0,2,0);$k::keybd_event(0x11,0,2,0);'ok'`;
      const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 3000);
      if (r.error) return `ERROR: ${r.error}`;
      return 'OK';
    }
    const mapped = safe.replace(/ctrl\+(\w)/gi,'^$1').replace(/alt\+(\w)/gi,'%$1').replace(/shift\+(\w)/gi,'+$1').replace(/enter/i,'{ENTER}').replace(/tab/i,'{TAB}').replace(/escape/i,'{ESC}');
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${mapped}'); 'ok'`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 3000);
    if (r.error) return `ERROR: ${r.error}`;
  } catch (e: unknown) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; }
  return 'OK';
}

export async function screenCapture(): Promise<{ path: string; base64: string } | null> {
  const dir = path.join(os.tmpdir(), 'jarvis-screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `screen_${Date.now()}.png`);
  try {
    const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $s=[System.Windows.Forms.Screen]::PrimaryScreen; $b=New-Object System.Drawing.Bitmap($s.Bounds.Width,$s.Bounds.Height); $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0,$b.Size); $b.Save('${fp.replace(/\\/g,'\\\\')}'); $g.Dispose();$b.Dispose();'ok'`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 10000);
    if (r.error) throw new Error(r.error);
    if (fs.existsSync(fp)) {
      const buf = fs.readFileSync(fp);
      return { path: fp, base64: buf.toString('base64') };
    }
  } catch (e: unknown) { return null; }
  return null;
}

export async function getScreenInfo(): Promise<string> {
  if (process.platform !== 'win32') return 'OK (not Windows)';
  try {
    const ps = 'Add-Type -AssemblyName System.Windows.Forms; $s=[System.Windows.Forms.Screen]::PrimaryScreen; $w=$s.Bounds.Width;$h=$s.Bounds.Height; Get-Process|Where-Object{$_.MainWindowTitle}|Select-Object -First 5|ForEach-Object{$_.MainWindowTitle}; Write-Host "RES:$w"+"x$h"';
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 5000);
    if (r.error) return `ERROR: ${r.error}`;
    const lines = (r.stdout || '').split('\n').filter(Boolean);
    const res = lines.find(l => l.startsWith('RES:'))?.replace('RES:','') || '?';
    const apps = lines.filter(l => !l.startsWith('RES:')).join(', ') || 'none';
    return `Pantalla: ${res} | Apps: ${apps}`;
  } catch (e: unknown) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; }
}

export async function getMousePosition(): Promise<{ x: number; y: number }> {
  try {
    const ps = `Add-Type -Name P -MemberDefinition '[DllImport("user32.dll")]public static extern bool GetCursorPos(out int x,out int y);' -PassThru; $x=0;$y=0;[P]::GetCursorPos([ref]$x,[ref]$y);"$x,$y"`;
    const r = await executeCommand(`powershell -Command "${ps}"`, process.cwd(), 3000);
    if (r.error) throw new Error(r.error);
    const p = (r.stdout || '0,0').trim().split(',');
    return { x: parseInt(p[0]) || 0, y: parseInt(p[1]) || 0 };
  } catch { return { x: 0, y: 0 }; }
}
