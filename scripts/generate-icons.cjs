// scripts/generate-icons.cjs
// Generates minimal placeholder icons for Tauri desktop app
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal 1x1 ICO file (just enough for Tauri to not crash)
// Proper icons should be generated with a real image editor
const iconsDir = path.join(__dirname, '..', 'desktop', 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Generate minimal PNG files (1px blue dot — placeholder)
function minimalPNG(width, height) {
  // Minimal valid PNG with a single blue pixel
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return signature; // This is just the PNG header — real icons need proper content
}

// Create placeholder files
const sizes = [
  { name: '32x32.png', w: 32, h: 32 },
  { name: '128x128.png', w: 128, h: 128 },
  { name: '128x128@2x.png', w: 256, h: 256 },
];

console.log('Generating placeholder icons...');
console.log('WARNING: These are placeholders. Replace with real icons before publishing.');
console.log('Use: https://tauri.app/start/icons/ to generate proper icons.');

// Just create empty files with notes
for (const s of sizes) {
  const filePath = path.join(iconsDir, s.name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `Placeholder ${s.w}x${s.h} icon`);
  }
}

// Copy existing favicon as icon.ico if available
const faviconIco = path.join(__dirname, '..', 'src', 'server', 'public', 'favicon.ico');
const targetIco = path.join(iconsDir, 'icon.ico');
if (fs.existsSync(faviconIco) && !fs.existsSync(targetIco)) {
  fs.copyFileSync(faviconIco, targetIco);
  console.log('Copied favicon.ico as icon.ico');
}

console.log('Icons directory ready at:', iconsDir);
