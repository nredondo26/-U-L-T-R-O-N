export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  reset: number;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  private limits: Record<string, number>;
  private windowMs: number;

  constructor(limits: Record<string, number>, windowMs: number) {
    this.limits = limits;
    this.windowMs = windowMs;
  }

  check(ip: string, url: string | undefined): RateLimitResult {
    const now = Date.now();
    let entry = this.hits.get(ip);
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + this.windowMs };
      this.hits.set(ip, entry);
    }
    entry.count++;
    const limit = this.limits[url || ''] || this.limits.default || 9999;
    return { limited: entry.count > limit, remaining: Math.max(0, limit - entry.count), reset: entry.reset };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, e] of this.hits) if (now > e.reset) this.hits.delete(ip);
  }

  get size(): number { return this.hits.size; }
}
