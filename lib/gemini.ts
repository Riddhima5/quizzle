/**
 * Google Gemini adapter (free tier) — SERVER ONLY.
 * Same contract as callTool() in lib/anthropic.ts, so prompts and the pipeline are provider-agnostic:
 * prompts build Anthropic-style messages; we translate them to Gemini `contents` here.
 *
 * Gemini supports truly FORCED function calling (mode ANY + allowedFunctionNames) and temperature,
 * so the original spec (forced tool use, temperature 0 for verification) applies as designed.
 */
import {
  ApiError,
  FunctionCallingConfigMode,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import { withRetry } from "./retry";
import {
  ConfigError,
  formatZodError,
  RefusalError,
  StructuredOutputError,
  type Effort,
  type MessageParam,
  type TextBlockParam,
  type ToolCallOptions,
  type ToolCallResult,
} from "./anthropic";

/** Google's recommended model for new free-tier keys (Nov 2026). Older ones (e.g. 2.5) 404 for new users. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
/**
 * Tried in order when a model reports 503 "high demand". Comma-separated in GEMINI_FALLBACK_MODEL;
 * set it to "" to disable.
 */
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash";

const THINKING: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  xhigh: ThinkingLevel.XHIGH,
  max: ThinkingLevel.XHIGH,
};

export function getGeminiFallbackModels(): string[] {
  return (process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_GEMINI_FALLBACK_MODEL)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

const isOverloaded = (error: unknown) => error instanceof ApiError && error.status === 503;

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

type GeminiModels = Pick<GoogleGenAI["models"], "generateContent">;
let client: { models: GeminiModels } | null = null;

/** Tests inject a fake; pass null to restore the real client. */
export function setGeminiForTests(fake: { models: GeminiModels } | null): void {
  client = fake;
}

function gemini(): { models: GeminiModels } {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ConfigError(
        "GEMINI_API_KEY is not set. Get a free key at aistudio.google.com and add it to .env.local.",
      );
    }
    // Per-request time limit: without it a request Google never answers hangs forever.
    client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } });
  }
  return client;
}

/** Drop JSON-Schema keywords Gemini's function schemas may reject; zod still enforces them. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    return Object.fromEntries(
      Object.entries(schema)
        .filter(([key]) => key !== "additionalProperties")
        .map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  return schema;
}

function systemText(system: string | TextBlockParam[]): string {
  return typeof system === "string" ? system : system.map((b) => b.text).join("\n\n");
}

/** Translate the (initial, user-only) Anthropic-style messages our prompts build. */
export function toGeminiContents(messages: readonly MessageParam[]): Content[] {
  return messages.map((m) => {
    const parts: Part[] = [];
    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else {
      for (const block of m.content ?? []) {
        if (block.type === "text") parts.push({ text: block.text });
        else if (block.type === "image" && block.source.type === "base64") {
          parts.push({
            inlineData: { mimeType: block.source.media_type, data: block.source.data },
          });
        }
      }
    }
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
}

export async function callToolGemini<T>(opts: ToolCallOptions<T>): Promise<ToolCallResult<T>> {
  const ai = gemini();
  let model = getGeminiModel();
  const contents = toGeminiContents(opts.messages);
  const totals = { input: 0, output: 0 };
  const started = Date.now();
  const MAX_ATTEMPTS = 2; // first try + one repair
  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const send = (m: string) =>
      ai.models.generateContent({
        model: m,
        contents,
        config: {
          systemInstruction: systemText(opts.system),
          maxOutputTokens: opts.maxTokens ?? 16000,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          // Cap "thinking" time per stage — the main lever on Gemini 3 latency.
          ...(opts.effort ? { thinkingConfig: { thinkingLevel: THINKING[opts.effort] } } : {}),
          tools: [
            {
              functionDeclarations: [
                {
                  name: opts.tool.name,
                  description: opts.tool.description,
                  parametersJsonSchema: toGeminiSchema(opts.tool.input_schema),
                },
              ],
            },
          ],
          // Forced tool use: the model must call exactly this function.
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [opts.tool.name],
            },
          },
        },
      });
    // Busy model (503 "high demand") → move on to the next fallback model after one retry,
    // instead of waiting through the full backoff on an overloaded model.
    const queue = [model, ...getGeminiFallbackModels().filter((m) => m !== model)];
    let response: GenerateContentResponse | undefined;
    for (let i = 0; i < queue.length && !response; i++) {
      const candidate = queue[i] as string;
      const isLast = i === queue.length - 1;
      try {
        response = await withRetry(() => send(candidate), { retries: isLast ? 3 : 1 });
        model = candidate;
      } catch (error) {
        if (!isOverloaded(error) || isLast) throw error;
        console.warn(`[gemini] ${candidate} overloaded, trying ${queue[i + 1]}`);
      }
    }
    if (!response) throw new StructuredOutputError(`Stage "${opts.stage}" got no response.`, "");
    totals.input += response.usageMetadata?.promptTokenCount ?? 0;
    totals.output += response.usageMetadata?.candidatesTokenCount ?? 0;

    if (response.promptFeedback?.blockReason) {
      throw new RefusalError(
        `The model declined this request (${response.promptFeedback.blockReason}).`,
      );
    }

    const call = response.functionCalls?.find((c) => c.name === opts.tool.name);
    const modelContent = response.candidates?.[0]?.content;
    if (!call) {
      lastProblem = `No function call (finish reason: ${response.candidates?.[0]?.finishReason ?? "unknown"}).`;
      if (modelContent) contents.push(modelContent);
      contents.push({
        role: "user",
        parts: [{ text: `You must respond by calling the ${opts.tool.name} function.` }],
      });
      continue;
    }

    const parsed = opts.schema.safeParse(call.args);
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

    // Repair turn: return the validation error as the function's response (history kept intact,
    // including thought signatures on the model's function-call parts).
    lastProblem = formatZodError(parsed.error);
    if (modelContent) contents.push(modelContent);
    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: opts.tool.name,
            response: {
              error: `Validation failed:\n${lastProblem}\nCall ${opts.tool.name} again with corrected arguments. Keep everything that was valid.`,
            },
          },
        },
      ],
    });
  }

  throw new StructuredOutputError(
    `Stage "${opts.stage}" did not return valid structured output after ${MAX_ATTEMPTS} attempts.`,
    lastProblem,
  );
}
