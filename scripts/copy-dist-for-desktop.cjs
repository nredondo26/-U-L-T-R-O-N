// scripts/copy-dist-for-desktop.cjs
// Copies ULTRON server exe, dashboard, and .env next to the desktop app resources
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicSrc = path.join(__dirname, '..', 'src', 'server', 'public');
const desktopResourceDir = path.join(__dirname, '..', 'desktop', 'src-tauri');

// Copy server exe
const exe = path.join(distDir, 'ultron.exe');
if (fs.existsSync(exe)) {
  fs.copyFileSync(exe, path.join(desktopResourceDir, 'ultron.exe'));
  console.log('Copied ultron.exe');
}

// Copy dashboard HTML directly from source
const publicDest = path.join(desktopResourceDir, 'public');
if (fs.existsSync(publicDest)) fs.rmSync(publicDest, { recursive: true });
fs.mkdirSync(publicDest, { recursive: true });

if (fs.existsSync(publicSrc)) {
  for (const f of fs.readdirSync(publicSrc)) {
    fs.copyFileSync(path.join(publicSrc, f), path.join(publicDest, f));
  }
  console.log('Copied dashboard files to desktop resources');
}

// Copy .env
const envFiles = [path.join(distDir, '.env'), path.join(process.cwd(), '.env')];
for (const env of envFiles) {
  if (fs.existsSync(env)) {
    fs.copyFileSync(env, path.join(desktopResourceDir, '.env'));
    console.log('Copied .env');
    break;
  }
}
