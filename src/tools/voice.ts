// src/tools/voice.ts
// Voice I/O: integracion con Voicebox + fallback a TTS nativo con voces naturales

import { executeCommand } from './execute';

interface SpeakOptions {
  rate?: number;
  volume?: number;
}

const VOICEBOX_URL = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493';
let voiceboxAvailable: boolean | null = null;

async function checkVoicebox(): Promise<boolean> {
  if (voiceboxAvailable !== null) return voiceboxAvailable;
  try {
    const r = await fetch(`${VOICEBOX_URL}/profiles`, { signal: AbortSignal.timeout(2000) });
    voiceboxAvailable = r.ok;
  } catch {
    voiceboxAvailable = false;
  }
  return voiceboxAvailable;
}

export async function speak(text: string, voice?: string, options?: SpeakOptions): Promise<string> {
  const safe = text.replace(/["`$]/g, '').slice(0, 1000);

  // Voz por defecto: Helena (español España) con fallback a Sabina (mexicana)
  const selectedVoice = voice || 'Microsoft Helena Desktop';

  if (await checkVoicebox()) {
    try {
      const r = await fetch(`${VOICEBOX_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: safe, profile: selectedVoice }),
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return `Hablando (Voicebox): "${safe.slice(0, 80)}..."`;
    } catch {}
  }

  return speakNative(safe, selectedVoice, options);
}

async function speakNative(text: string, voice?: string, options?: SpeakOptions): Promise<string> {
  if (process.platform === 'win32') {
    return speakWindows(text, voice, options);
  }
  if (process.platform === 'darwin') {
    const voiceFlag = voice ? ` -v "${voice}"` : '';
    const rateFlag = options?.rate ? ` -r ${Math.max(1, Math.round((options.rate + 10) * 10))}` : '';
    await executeCommand(`say${voiceFlag}${rateFlag} "${text}"`, process.cwd(), 30000);
    return `Hablando (macOS TTS): "${text.slice(0, 80)}..."`;
  }
  await executeCommand(`echo "${text}" | espeak -v es`, process.cwd(), 30000);
  return `Hablando (espeak): "${text.slice(0, 80)}..."`;
}

async function speakWindows(text: string, voice?: string, options?: SpeakOptions): Promise<string> {
  // Determinar la voz a usar
  // Intentar usar Helena (español España) si no se especifica otra, con fallback a Sabina
  let selectedVoice = voice || 'Microsoft Helena Desktop';
  const rate = options?.rate ?? -2;
  const volume = options?.volume ?? 100;

  // Dividir el texto en frases (por punto, signo de interrogación, exclamación, punto y coma, dos puntos)
  const sentences = text
    .split(/(?<=[.!?;:])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Si hay pocas frases o el texto es corto, no dividir
  const phrases = sentences.length <= 1 ? [text] : sentences;

  // Escapar comillas simples para PowerShell
  const escapePs = (t: string) => t.replace(/'/g, "''");

  // Construir el script de PowerShell que procesa cada frase con pausas
  const speakScript = phrases
    .map((phrase, i) => {
      const escaped = escapePs(phrase);
      const isLast = i === phrases.length - 1;
      // Pausa de 300ms entre frases (excepto la última)
      const pause = isLast ? '' : 'Start-Sleep -Milliseconds 300;';
      return `$s.Speak('${escaped}'); ${pause}`;
    })
    .join(' ');

  const cmd = `powershell -Command "Add-Type -AssemblyName System.Speech; try { $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${rate}; $s.Volume = ${volume}; try { $s.SelectVoice('${escapePs(selectedVoice)}'); } catch { Write-Warning 'Voz ${escapePs(selectedVoice)} no encontrada, usando voz predeterminada'; } ${speakScript} Write-Output $s.Voice.Name } catch { Write-Error $_ }"`;

  const result = await executeCommand(cmd, process.cwd(), 60000);

  const voiceUsed = result.stdout?.trim() || selectedVoice;
  return `Hablando (${voiceUsed}): "${text.slice(0, 80)}..."`;
}

export async function listVoices(): Promise<string[]> {
  if (await checkVoicebox()) {
    try {
      const r = await fetch(`${VOICEBOX_URL}/profiles`, { signal: AbortSignal.timeout(3000) });
      const data = await r.json() as Array<{ id: string; name: string }>;
      return data.map(v => v.name || v.id);
    } catch {}
  }

  // List Windows voices
  if (process.platform === 'win32') {
    const result = await executeCommand(
      `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name + ' (' + $_.VoiceInfo.Culture.Name + ')' }"`,
      process.cwd(),
      5000,
    );
    return result.stdout.split('\n').filter(Boolean).map(v => v.trim());
  }

  return ['system-default'];
}

export async function installSpanishVoice(): Promise<string> {
  if (process.platform !== 'win32') return 'Solo Windows soporta instalacion automatica de voces.';

  const result = await executeCommand(
    `powershell -Command "
Write-Host 'Verificando voces en espanol instaladas...'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo }
$esVoices = $voices | Where-Object { $_.Culture.Name -like 'es-*' }

if ($esVoices) {
  Write-Host 'Voces en espanol ya instaladas:'
  $esVoices | ForEach-Object { Write-Host ('  ' + $_.Name + ' (' + $_.Culture.Name + ') - ' + $_.Gender) }
} else {
  Write-Host 'No hay voces en espanol instaladas.'
  Write-Host ''
  Write-Host 'Para instalar voces en espanol:'
  Write-Host '1. Abre Configuracion (Win + I)'
  Write-Host '2. Ve a Hora e idioma > Voz'
  Write-Host '3. En Administrar voces, haz clic en Agregar voces'
  Write-Host '4. Busca Espanol (Mexico) y agrega Sabina'
  Write-Host '5. Reinicia J.A.R.V.I.S.'
}
"`,
    process.cwd(),
    10000,
  );
  return result.stdout || 'Comando ejecutado.';
}

export function isVoiceboxAvailable(): Promise<boolean> {
  return checkVoicebox();
}
