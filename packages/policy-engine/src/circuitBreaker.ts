// In-memory circuit breaker keyed by serverId. Trips OPEN after `failureThreshold`
// consecutive failures and stays open until `cooldownMs` elapses; the next isOpen() check
// after the cooldown closes it again and lets one call probe the server (time-based half-open).
// ponytail: process-local Map — fine for a single server instance. Move to shared storage
// (Redis) only if the engine is ever horizontally scaled.
export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

interface BreakerState {
  failureCount: number;
  openedAt: number | null;
}

export class CircuitBreaker {
  private readonly states = new Map<string, BreakerState>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  recordFailure(serverId: string): void {
    const state = this.stateFor(serverId);
    state.failureCount += 1;
    if (state.failureCount >= this.failureThreshold && state.openedAt === null) {
      state.openedAt = Date.now();
    }
  }

  recordSuccess(serverId: string): void {
    this.states.set(serverId, { failureCount: 0, openedAt: null });
  }

  isOpen(serverId: string): boolean {
    const state = this.states.get(serverId);
    if (!state || state.openedAt === null) return false;
    if (Date.now() - state.openedAt >= this.cooldownMs) {
      // Cooldown elapsed: close and let the next call probe the server.
      state.failureCount = 0;
      state.openedAt = null;
      return false;
    }
    return true;
  }

  private stateFor(serverId: string): BreakerState {
    let state = this.states.get(serverId);
    if (!state) {
      state = { failureCount: 0, openedAt: null };
      this.states.set(serverId, state);
    }
    return state;
  }
}
