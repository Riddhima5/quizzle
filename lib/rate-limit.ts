/**
 * Simple in-memory sliding-window rate limiter keyed by IP (Section 4).
 * Per-process only — fine for a single-instance v1; swap for Redis/Upstash in production.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? t;
      return { ok: false, remaining: 0, retryAfterMs: this.windowMs - (t - oldest) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    return { ok: true, remaining: this.max - recent.length, retryAfterMs: 0 };
  }
}

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const WINDOW = envInt("RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000);

/** Shared limiters (module singletons survive across requests in one server process). */
export const generationLimiter = new RateLimiter(envInt("RATE_LIMIT_MAX", 10), WINDOW);
/** Photo transcription is cheaper per call but can be 10 images — separate, looser bucket. */
export const transcriptionLimiter = new RateLimiter(20, WINDOW);
