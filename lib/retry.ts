import Anthropic from "@anthropic-ai/sdk";
import { ApiError as GeminiApiError } from "@google/genai";
import Groq from "groq-sdk";

export interface RetryOptions {
  /** Max retries after the first attempt (spec: 3). */
  retries?: number;
  /** Base delay in ms; doubles each attempt, plus jitter. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retryable = rate limits (429), overloaded (529), 5xx, timeouts and connection errors.
 * 4xx client errors (400 bad request, 401 auth, 404) are NOT retried — retrying won't help.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof GeminiApiError) return error.status === 429 || error.status >= 500;
  if (error instanceof Groq.APIConnectionError) return true;
  if (error instanceof Groq.APIError) {
    const s = error.status;
    return typeof s === "number" && (s === 429 || s >= 500);
  }
  if (error instanceof Anthropic.APIConnectionError) return true; // includes timeout subclass
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    return typeof status === "number" && (status === 408 || status === 409 || status >= 500);
  }
  return false;
}

/** Honour a server `retry-after` header (seconds) when present. */
function retryAfterMs(error: unknown): number | undefined {
  if ((error instanceof Anthropic.APIError || error instanceof Groq.APIError) && error.headers) {
    const value = error.headers.get("retry-after");
    if (value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }
  }
  return undefined;
}

export function backoffDelay(attempt: number, base: number, max: number): number {
  const exp = base * 2 ** attempt;
  const jitter = Math.random() * base;
  return Math.min(max, exp + jitter);
}

/** Exponential backoff wrapper (Section 4: max 3 retries on 429 / overloaded). */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 20_000;
  const sleep = opts.sleep ?? defaultSleep;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      const delay = Math.min(max, retryAfterMs(error) ?? backoffDelay(attempt, base, max));
      opts.onRetry?.(attempt + 1, delay, error);
      await sleep(delay);
      attempt++;
    }
  }
}
