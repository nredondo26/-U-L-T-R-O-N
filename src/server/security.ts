import type { IncomingMessage, ServerResponse } from 'http';

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function applySecurityHeaders(req: IncomingMessage, res: ServerResponse): void {
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.setHeader(key, value);
  }
  res.setHeader('Content-Security-Policy', `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  const origin = req.headers.origin;
  if (origin && (origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}
