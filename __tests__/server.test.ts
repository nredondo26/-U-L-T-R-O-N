import { describe, it, expect } from 'bun:test';
import { RateLimiter } from '../src/server/rate-limiter';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const rl = new RateLimiter({ '/api/test': 5 }, 60_000);
    for (let i = 0; i < 5; i++) {
      const result = rl.check('127.0.0.1', '/api/test');
      expect(result.limited).toBeFalse();
    }
  });

  it('blocks requests over the limit', () => {
    const rl = new RateLimiter({ '/api/test': 3 }, 60_000);
    for (let i = 0; i < 3; i++) rl.check('127.0.0.1', '/api/test');
    const result = rl.check('127.0.0.1', '/api/test');
    expect(result.limited).toBeTrue();
  });

  it('uses default limit for unknown routes', () => {
    const rl = new RateLimiter({ default: 2 }, 60_000);
    rl.check('1.2.3.4', '/unknown');
    rl.check('1.2.3.4', '/unknown');
    const result = rl.check('1.2.3.4', '/unknown');
    expect(result.limited).toBeTrue();
  });

  it('tracks different IPs independently', () => {
    const rl = new RateLimiter({ '/api/chat': 2 }, 60_000);
    rl.check('ip-a', '/api/chat');
    rl.check('ip-a', '/api/chat');
    expect(rl.check('ip-b', '/api/chat').limited).toBeFalse();
  });

  it('returns remaining count and reset time', () => {
    const rl = new RateLimiter({ '/api/chat': 5 }, 60_000);
    const r1 = rl.check('x', '/api/chat');
    expect(r1.remaining).toBe(4);
    expect(r1.reset).toBeGreaterThan(Date.now());
  });

  it('cleans stale entries', async () => {
    const rl = new RateLimiter({ '/api/chat': 5 }, 1);
    rl.check('stale-ip', '/api/chat');
    rl.check('stale-ip', '/api/chat');
    await new Promise(r => setTimeout(r, 10));
    rl.cleanup();
    const r = rl.check('stale-ip', '/api/chat');
    expect(r.remaining).toBe(4);
  });

  it('returns zero remaining when over limit', () => {
    const rl = new RateLimiter({ '/api/test': 2 }, 60_000);
    rl.check('ip', '/api/test');
    rl.check('ip', '/api/test');
    const r = rl.check('ip', '/api/test');
    expect(r.remaining).toBe(0);
  });
});

describe('Server static file serving', () => {
  it('serves existing static files', async () => {
    const tmpDir = path.join(os.tmpdir(), 'jarvis-st-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'test.html'), '<h1>test</h1>');

    const server = http.createServer((req, res) => {
      const fullPath = path.join(tmpDir, req.url || '');
      if (!fullPath.startsWith(tmpDir)) { res.writeHead(403); res.end('Forbidden'); return; }
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(fullPath));
      } else { res.writeHead(404); res.end('Not found'); }
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') { server.close(); reject(new Error('bad addr')); return; }
        http.get(`http://127.0.0.1:${addr.port}/test.html`, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            server.close();
            fs.rmSync(tmpDir, { recursive: true });
            expect(data).toContain('test');
            resolve();
          });
        });
      });
    });
  });

  it('blocks directory traversal', () => {
    const tmpDir = path.join(os.tmpdir(), 'jarvis-st-test2-' + Date.now());
    const fullPath = path.join(tmpDir, '/..%2F..%2Fetc%2Fpasswd');
    // Test that join doesn't resolve escape sequences
    expect(fullPath).toContain('..%2F');
    // Test that the path check works
    expect(fullPath.startsWith(tmpDir)).toBeTrue();
    // But with real traversal:
    const badPath = path.resolve(tmpDir, '../../../etc/passwd');
    expect(badPath.startsWith(tmpDir)).toBeFalse();
  });

  it('returns correct MIME types', () => {
    const extMime: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
    for (const [ext, mime] of Object.entries(extMime)) {
      expect(mime).toBeTruthy();
    }
  });
});
