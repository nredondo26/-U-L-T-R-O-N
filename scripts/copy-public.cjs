// scripts/copy-public.cjs
// Copies static web assets and env template next to the compiled executable
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'server', 'public');
const dest = path.join(__dirname, '..', 'dist', 'public');

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(src);
for (const file of files) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log(`Copied ${files.length} static files to dist/public/`);

// Copy .env.example to dist for reference
const envExample = path.join(__dirname, '..', '.env.example');
const envDest = path.join(__dirname, '..', 'dist', '.env.example');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envDest);
}

// Copy .env if it exists (user's actual keys)
const envFile = path.join(__dirname, '..', '.env');
const envFileDest = path.join(__dirname, '..', 'dist', '.env');
if (fs.existsSync(envFile)) {
  fs.copyFileSync(envFile, envFileDest);
  console.log('Copied .env to dist/');
} else {
  console.log('No .env found — copy .env.example to .env and add your API keys');
}
