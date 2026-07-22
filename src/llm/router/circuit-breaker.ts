// Circuit breaker — 3 capas de resiliencia

interface ProviderState {
  blocked: boolean;
  blockedAt: number | null;
  cooldownMs: number;
  failCount: number;
}

interface ConnectionState {
  cooldownUntil: number;
  baseCooldownMs: number;
  failCount: number;
}

interface ModelState {
  locked: boolean;
  lockedAt: number | null;
  failCount: number;
}

export class CircuitBreaker {
  private providers = new Map<string, ProviderState>();
  private connections = new Map<string, ConnectionState>();
  private models = new Map<string, ModelState>();

  private providerBlockDuration = 120_000;
  private modelLockDuration = 60_000;

  recordProviderError(name: string, isAuth: boolean): void {
    const s = this.providers.get(name) || { blocked: false, blockedAt: null, cooldownMs: 5000, failCount: 0 };
    s.failCount++;
    if (isAuth || s.failCount >= 5) {
      s.blocked = true;
      s.blockedAt = Date.now();
      s.cooldownMs = isAuth ? this.providerBlockDuration : Math.min(s.cooldownMs * 2, 120_000);
      s.failCount = 0;
    }
    this.providers.set(name, s);
  }

  recordProviderSuccess(name: string): void {
    const s = this.providers.get(name);
    if (s) { s.failCount = 0; s.blocked = false; s.blockedAt = null; s.cooldownMs = 5000; }
  }

  isProviderBlocked(name: string): boolean {
    const s = this.providers.get(name);
    if (!s || !s.blocked) return false;
    if (Date.now() - s.blockedAt! > s.cooldownMs) {
      s.blocked = false;
      s.blockedAt = null;
      s.cooldownMs = 5000;
      return false;
    }
    return true;
  }

  recordConnectionError(baseURL: string): void {
    const key = baseURL;
    const s = this.connections.get(key) || { cooldownUntil: 0, baseCooldownMs: 3000, failCount: 0 };
    s.failCount++;
    s.baseCooldownMs = Math.min(s.baseCooldownMs * 2, 30_000);
    s.cooldownUntil = Date.now() + s.baseCooldownMs;
    this.connections.set(key, s);
  }

  recordConnectionSuccess(baseURL: string): void {
    const s = this.connections.get(baseURL);
    if (s) { s.failCount = 0; s.baseCooldownMs = 3000; s.cooldownUntil = 0; }
  }

  isConnectionCooling(baseURL: string): boolean {
    const s = this.connections.get(baseURL);
    return s ? Date.now() < s.cooldownUntil : false;
  }

  recordModelError(model: string): void {
    const s = this.models.get(model) || { locked: false, lockedAt: null, failCount: 0 };
    s.failCount++;
    if (s.failCount >= 3) {
      s.locked = true;
      s.lockedAt = Date.now();
    }
    this.models.set(model, s);
  }

  recordModelSuccess(model: string): void {
    const s = this.models.get(model);
    if (s) { s.failCount = 0; s.locked = false; s.lockedAt = null; }
  }

  isModelLocked(model: string): boolean {
    const s = this.models.get(model);
    if (!s || !s.locked) return false;
    if (Date.now() - s.lockedAt! > this.modelLockDuration) {
      s.locked = false;
      s.lockedAt = null;
      return false;
    }
    return true;
  }

  getState(): object {
    return {
      providers: Object.fromEntries(this.providers),
      models: Object.fromEntries(this.models),
    };
  }

  preBlock(model: string): void {
    this.models.set(model, { locked: true, lockedAt: Date.now(), failCount: 3 });
  }

  preUnblock(model: string): void {
    this.models.set(model, { locked: false, lockedAt: null, failCount: 0 });
  }
}
