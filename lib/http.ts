import Anthropic from "@anthropic-ai/sdk";
import { ApiError as GeminiApiError } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { ConfigError, RefusalError, StructuredOutputError } from "./anthropic";
import type { RateLimiter } from "./rate-limit";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimited(req: Request, limiter: RateLimiter) {
  const result = limiter.check(clientIp(req));
  if (result.ok) return null;
  const minutes = Math.ceil(result.retryAfterMs / 60_000);
  const res = jsonError(
    429,
    "rate_limited",
    `You've hit the limit for now — try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  );
  res.headers.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  return res;
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json", "Request body must be JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "invalid_request",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Map any thrown error to a user-friendly message + status. Never leaks the API key or stack. */
export function describeError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof ConfigError) return { status: 500, code: "config", message: error.message };
  if (error instanceof RefusalError)
    return { status: 422, code: "refusal", message: error.message };
  if (error instanceof StructuredOutputError) {
    return {
      status: 502,
      code: "bad_model_output",
      message: "The model returned an unexpected format. Please try again.",
    };
  }
  if (error instanceof Groq.APIConnectionError) {
    return {
      status: 504,
      code: "upstream_timeout",
      message: "Groq didn't respond in time — please try again.",
    };
  }
  if (error instanceof Groq.APIError) {
    if (error.status === 429) {
      return {
        status: 429,
        code: "upstream_rate_limited",
        message:
          "Groq's free-tier limit was reached. Wait a minute and try again, or ask for fewer questions.",
      };
    }
    if (error.status === 401 || error.status === 403) {
      return { status: 500, code: "auth", message: "The GROQ_API_KEY in .env.local was rejected." };
    }
    if (error.status === 404) {
      return {
        status: 500,
        code: "model",
        message: "That Groq model isn't available — check GROQ_MODEL.",
      };
    }
    if (error.status === 413) {
      return {
        status: 413,
        code: "too_large",
        message: "Those notes are too long for Groq's free tier — shorten them or split them.",
      };
    }
    if ((error.status ?? 0) >= 500) {
      return {
        status: 503,
        code: "upstream_unavailable",
        message: "Groq is temporarily unavailable — please try again shortly.",
      };
    }
    return { status: 502, code: "upstream_error", message: "The request to Groq failed." };
  }
  if (error instanceof GeminiApiError) {
    if (error.status === 429) {
      return {
        status: 429,
        code: "upstream_rate_limited",
        message:
          "Gemini's free-tier limit was reached. Wait a minute (or until tomorrow if the daily quota is used up) and try again.",
      };
    }
    if (error.status === 400 && /api key/i.test(error.message)) {
      return { status: 500, code: "auth", message: "The GEMINI_API_KEY in .env.local is invalid." };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        status: 500,
        code: "auth",
        message: "The GEMINI_API_KEY in .env.local was rejected.",
      };
    }
    if (error.status === 404) {
      return {
        status: 500,
        code: "model",
        message: "That Gemini model isn't available — check GEMINI_MODEL.",
      };
    }
    if (error.status >= 500) {
      return {
        status: 503,
        code: "upstream_unavailable",
        message: "Gemini is temporarily overloaded — please try again shortly.",
      };
    }
    return { status: 502, code: "upstream_error", message: "The request to Gemini failed." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      code: "upstream_rate_limited",
      message: "Claude is busy right now — please try again in a minute.",
    };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 500, code: "auth", message: "The server's Anthropic API key is invalid." };
  }
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
    return {
      status: 503,
      code: "upstream_unavailable",
      message: "Claude is temporarily overloaded — please try again shortly.",
    };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, code: "upstream_error", message: "The request to Claude failed." };
  }
  return { status: 500, code: "internal", message: "Something went wrong. Please try again." };
}

export function errorResponse(error: unknown) {
  const { status, code, message } = describeError(error);
  if (status >= 500) console.error("[quizzle]", error);
  return jsonError(status, code, message);
}
