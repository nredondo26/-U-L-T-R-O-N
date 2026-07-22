import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const exe = join(root, 'dist', 'ultron.exe');
const ico = join(root, 'src', 'server', 'public', 'favicon.ico');
const rcedit = join(root, 'node_modules', 'rcedit', 'bin', 'rcedit.exe');

try {
  execSync(`"${rcedit}" "${exe}" --set-icon "${ico}"`, { stdio: 'inherit' });
  console.log('Icon set successfully');
} catch (e) {
  console.error('Failed to set icon:', e.message);
  process.exit(1);
}
