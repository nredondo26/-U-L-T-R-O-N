// scripts/copy-dist-for-desktop.cjs
// Copies ULTRON server exe and .env next to the desktop app
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const desktopResourceDir = path.join(__dirname, '..', 'desktop', 'src-tauri');

// Copy server exe
const exe = path.join(distDir, 'ultron.exe');
if (fs.existsSync(exe)) {
  // In development, Tauri looks for resources in the resource dir
  const targetExe = path.join(desktopResourceDir, 'ultron.exe');
  fs.copyFileSync(exe, targetExe);
  console.log('Copied ultron.exe to desktop resources');
}

// Copy .env
const env = path.join(process.cwd(), '.env');
const distEnv = path.join(distDir, '.env');
const envSrc = fs.existsSync(distEnv) ? distEnv : env;
if (fs.existsSync(envSrc)) {
  const targetEnv = path.join(desktopResourceDir, '.env');
  fs.copyFileSync(envSrc, targetEnv);
  console.log('Copied .env to desktop resources');
}

// Copy public files
const publicSrc = path.join(distDir, 'public');
const publicDest = path.join(desktopResourceDir, 'public');
if (fs.existsSync(publicSrc)) {
  if (fs.existsSync(publicDest)) fs.rmSync(publicDest, { recursive: true });
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('Copied public/ to desktop resources');
}

console.log('Desktop resources ready!');
