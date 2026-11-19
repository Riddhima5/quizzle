/**
 * Groq adapter (free tier, very fast) — SERVER ONLY.
 * Same contract as callTool(): prompts build Anthropic-style messages; we translate them to
 * OpenAI-style chat messages here. Groq supports truly FORCED tool calls
 * (`tool_choice: {type: "function", function: {name}}`) and temperature.
 */
import Groq from "groq-sdk";
import type {
  ChatCompletion,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "groq-sdk/resources/chat/completions";
import { withRetry } from "./retry";
import {
  ConfigError,
  formatZodError,
  StructuredOutputError,
  type MessageParam,
  type TextBlockParam,
  type ToolCallOptions,
  type ToolCallResult,
} from "./anthropic";

/**
 * Chosen from live runs on 2026-11-19 (same sample notes, 2 per type):
 *  - openai/gpt-oss-120b: 7 s end-to-end, no malformed tool calls, 6/6 verified → text default.
 *    It rejects image input, so it can't transcribe photos.
 *  - qwen/qwen3.8-27b: reads images well (photo transcription), but often emits malformed tool
 *    calls (garbled tool name) → vision default and text fallback.
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

/** Text-only fallback when the main model keeps producing malformed tool calls. */
export const DEFAULT_GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b";
export const getGroqFallbackModel = () =>
  (process.env.GROQ_FALLBACK_MODEL ?? DEFAULT_GROQ_FALLBACK_MODEL).trim();

/** Groq's own rejection of a malformed tool call (400, code "tool_use_failed"). */
export function isToolUseFailed(error: unknown): boolean {
  return (
    error instanceof Groq.BadRequestError &&
    JSON.stringify(error.error ?? "").includes("tool_use_failed")
  );
}

export const getGroqModel = () => process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
export const getGroqVisionModel = () =>
  process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL;

type GroqChat = { chat: { completions: { create: Groq["chat"]["completions"]["create"] } } };
let client: GroqChat | null = null;

/** Tests inject a fake; pass null to restore the real client. */
export function setGroqForTests(fake: GroqChat | null): void {
  client = fake;
}

function groq(): GroqChat {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ConfigError(
        "GROQ_API_KEY is not set. Get a free key at console.groq.com and add it to .env.local.",
      );
    }
    // Per-request time limit so a stuck request fails instead of hanging; retries are ours.
    client = new Groq({ apiKey, timeout: 120_000, maxRetries: 0 });
  }
  return client;
}

const systemText = (system: string | TextBlockParam[]) =>
  typeof system === "string" ? system : system.map((b) => b.text).join("\n\n");

/** Translate the (initial, user-only) Anthropic-style messages our prompts build. */
export function toGroqMessages(
  system: string | TextBlockParam[],
  messages: readonly MessageParam[],
): { messages: ChatCompletionMessageParam[]; hasImage: boolean } {
  let hasImage = false;
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: systemText(system) }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push(
        m.role === "assistant"
          ? { role: "assistant", content: m.content }
          : { role: "user", content: m.content },
      );
      continue;
    }
    const parts: ChatCompletionContentPart[] = [];
    for (const block of m.content ?? []) {
      if (block.type === "text") parts.push({ type: "text", text: block.text });
      else if (block.type === "image" && block.source.type === "base64") {
        hasImage = true;
        parts.push({
          type: "image_url",
          image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
        });
      }
    }
    out.push({ role: "user", content: parts });
  }
  return { messages: out, hasImage };
}

export async function callToolGroq<T>(opts: ToolCallOptions<T>): Promise<ToolCallResult<T>> {
  const api = groq();
  const { messages, hasImage } = toGroqMessages(opts.system, opts.messages);
  let model = hasImage ? getGroqVisionModel() : getGroqModel();
  const totals = { input: 0, output: 0 };
  const started = Date.now();
  const MAX_ATTEMPTS = 2; // first try + one repair
  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Groq rejects malformed tool calls itself (400 tool_use_failed, e.g. a garbled tool name).
    // That's a sampling glitch: retry twice, then (text-only) switch to the fallback model.
    const send = (m: string) =>
      api.chat.completions.create({
        model: m,
        messages,
        max_completion_tokens: Math.min(opts.maxTokens ?? 8000, 8000),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        tools: [
          {
            type: "function",
            function: {
              name: opts.tool.name,
              description: opts.tool.description,
              parameters: opts.tool.input_schema as Record<string, unknown>,
            },
          },
        ],
        // Forced tool use: the model must call exactly this function.
        tool_choice: { type: "function", function: { name: opts.tool.name } },
      }) as Promise<ChatCompletion>;
    const fallback = getGroqFallbackModel();
    const candidates = [
      model,
      model,
      model,
      ...(!hasImage && fallback && fallback !== model ? [fallback] : []),
    ];
    let response: ChatCompletion | undefined;
    for (const [i, candidate] of candidates.entries()) {
      try {
        response = await withRetry(() => send(candidate));
        model = candidate;
        break;
      } catch (error) {
        if (!isToolUseFailed(error) || i === candidates.length - 1) throw error;
        console.warn(`[groq] ${candidate} produced a malformed tool call, retrying (${i + 1})`);
      }
    }
    if (!response) throw new StructuredOutputError(`Stage "${opts.stage}" got no response.`, "");
    totals.input += response.usage?.prompt_tokens ?? 0;
    totals.output += response.usage?.completion_tokens ?? 0;

    const choice = response.choices[0];
    const call = choice?.message.tool_calls?.find((c) => c.function.name === opts.tool.name);
    if (!call) {
      lastProblem = `No tool call (finish reason: ${choice?.finish_reason ?? "unknown"}).`;
      messages.push({ role: "assistant", content: choice?.message.content ?? "" });
      messages.push({
        role: "user",
        content: `You must respond by calling the ${opts.tool.name} function.`,
      });
      continue;
    }

    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      args = undefined;
    }
    const parsed = opts.schema.safeParse(args);
    if (parsed.success) {
      const usage = {
        stage: opts.stage,
        model,
        inputTokens: totals.input,
        outputTokens: totals.output,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: Date.now() - started,
        attempts: attempt,
      };
      opts.onUsage?.(usage);
      return { data: parsed.data, attempts: attempt, usage };
    }

    // Repair turn: return the validation error as the tool result.
    lastProblem =
      args === undefined ? "Arguments were not valid JSON." : formatZodError(parsed.error);
    messages.push({ role: "assistant", content: null, tool_calls: [call] });
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: `Validation failed:\n${lastProblem}\nCall ${opts.tool.name} again with corrected arguments. Keep everything that was valid.`,
    });
  }

  throw new StructuredOutputError(
    `Stage "${opts.stage}" did not return valid structured output after ${MAX_ATTEMPTS} attempts.`,
    lastProblem,
  );
}
