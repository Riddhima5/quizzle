/**
 * Anthropic client wrapper — SERVER ONLY.
 *
 * Responsibilities:
 *  - Lazily construct one SDK client (API key read from env by the SDK; never sent to the browser).
 *  - `callTool()`: the single entry point every prompt uses. It requests a structured tool call,
 *    validates the tool input with zod, and retries ONCE with the validation error appended
 *    (Section 3.3). Transport failures (429 / overloaded / 5xx) are retried separately with
 *    exponential backoff (lib/retry.ts).
 *  - Per-model capability gating: newer models reject forced `tool_choice` and sampling params,
 *    so we adapt the request instead of hard-coding one shape.
 *  - Usage + latency reporting per pipeline stage (for the eval harness).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { callToolGemini } from "./gemini";
import { callToolGroq } from "./groq";
import { withRetry } from "./retry";

type Beta = Anthropic.Beta.Messages.BetaMessage;
export type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type TextBlockParam = Anthropic.Beta.Messages.BetaTextBlockParam;
export type ContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

if (typeof window !== "undefined") {
  throw new Error("lib/anthropic.ts must never be imported in the browser.");
}

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

// ---------------------------------------------------------------------------
// Model capabilities
// ---------------------------------------------------------------------------

export interface ModelCaps {
  /** `tool_choice: {type:"tool"}` accepted (and thinking is off by default so it doesn't conflict). */
  forcedToolChoice: boolean;
  /** `output_config.effort` accepted. */
  effort: boolean;
}

const stripDate = (model: string) => model.replace(/-\d{8}$/, "");

/** Older models that accept forced tool_choice without thinking turned on. */
const FORCED_TOOL_CHOICE = new Set([
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
]);
const NO_EFFORT = new Set(["claude-sonnet-4-5", "claude-haiku-4-5"]);

export function modelCaps(model: string): ModelCaps {
  const id = stripDate(model);
  return { forcedToolChoice: FORCED_TOOL_CHOICE.has(id), effort: !NO_EFFORT.has(id) };
}

// ---------------------------------------------------------------------------
// Client (injectable for tests)
// ---------------------------------------------------------------------------

export interface MessagesAPI {
  create(params: CreateParams): Promise<Beta>;
}

let override: MessagesAPI | null = null;
let singleton: Anthropic | null = null;

/** Tests inject a fake; pass null to restore the real client. */
export function setMessagesAPIForTests(api: MessagesAPI | null): void {
  override = api;
}

function messagesAPI(): MessagesAPI {
  if (override) return override;
  if (!singleton) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ConfigError("ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local.");
    }
    // maxRetries: 0 — retries are owned by withRetry() so the policy is explicit and testable.
    singleton = new Anthropic({ maxRetries: 0 });
  }
  const client = singleton;
  // Stream under the hood so large generations (up to 60 items + thinking) never hit HTTP timeouts.
  return { create: (params) => client.beta.messages.stream(params).finalMessage() };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** The model declined (stop_reason "refusal") even after server-side fallback. */
export class RefusalError extends Error {
  override name = "RefusalError";
}

/** Output never satisfied the schema after the allowed repair attempt. */
export class StructuredOutputError extends Error {
  override name = "StructuredOutputError";
  constructor(
    message: string,
    readonly details: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Usage reporting
// ---------------------------------------------------------------------------

export interface UsageRecord {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  attempts: number;
}

export type UsageSink = (record: UsageRecord) => void;

// ---------------------------------------------------------------------------
// Structured tool call
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema. Must use additionalProperties:false + required for strict mode. */
  input_schema: Anthropic.Beta.Messages.BetaTool.InputSchema;
}

export interface ToolCallOptions<T> {
  stage: string;
  system: string | TextBlockParam[];
  messages: MessageParam[];
  tool: ToolDef;
  schema: z.ZodType<T>;
  effort?: Effort;
  maxTokens?: number;
  onUsage?: UsageSink;
  model?: string;
  /** Applied on Gemini. Current Claude models reject sampling params, so Claude ignores it. */
  temperature?: number;
}

export interface ToolCallResult<T> {
  data: T;
  attempts: number;
  usage: UsageRecord;
}

/** Find the tool_use block for `toolName` in a response. Pure — unit tested. */
export function findToolUse(
  message: Pick<Beta, "content">,
  toolName: string,
): Anthropic.Beta.Messages.BetaToolUseBlock | undefined {
  return message.content.find(
    (b): b is Anthropic.Beta.Messages.BetaToolUseBlock =>
      b.type === "tool_use" && b.name === toolName,
  );
}

/** Compact, model-readable rendering of zod issues for the repair turn. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 15)
    .map((i) => `- at "${i.path.join(".") || "(root)"}": ${i.message}`)
    .join("\n");
}

/**
 * Request a structured tool call, validate with zod, and repair once on failure.
 *
 * On models that accept it we force `tool_choice`; on newer models (which reject forced tool use)
 * we use `auto` + `strict: true` + an explicit instruction, then treat a missing call like a
 * validation failure. Either way the caller gets typed, validated data or a clear error.
 */
export type Provider = "groq" | "gemini" | "anthropic";

/** LLM_PROVIDER picks the backend; default is Gemini (free tier). Tests inject a fake Claude. */
export function getProvider(): Provider {
  if (override) return "anthropic";
  const chosen = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (chosen === "groq" || chosen === "gemini" || chosen === "anthropic") return chosen;
  // Not chosen explicitly: use Groq if its key is set (fast, reliable free tier), else Gemini.
  return process.env.GROQ_API_KEY ? "groq" : "gemini";
}

export async function callTool<T>(opts: ToolCallOptions<T>): Promise<ToolCallResult<T>> {
  const provider = getProvider();
  if (provider === "groq") return callToolGroq(opts);
  if (provider === "gemini") return callToolGemini(opts);
  const model = opts.model ?? getModel();
  const caps = modelCaps(model);
  const api = messagesAPI();

  const tool: Anthropic.Beta.Messages.BetaTool = { ...opts.tool, strict: true };
  const toolChoice: Anthropic.Beta.Messages.BetaToolChoice = caps.forcedToolChoice
    ? { type: "tool", name: opts.tool.name }
    : { type: "auto", disable_parallel_tool_use: true };

  const messages: MessageParam[] = [...opts.messages];
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const started = Date.now();
  const MAX_ATTEMPTS = 2; // first try + one repair (Section 3.3)

  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const params: CreateParams = {
      model,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      messages,
      tools: [tool],
      tool_choice: toolChoice,
      // Server-side refusal fallback: on a policy decline the API re-runs on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(caps.effort && opts.effort ? { output_config: { effort: opts.effort } } : {}),
    };

    const response = await withRetry(() => api.create(params));
    totals.input += response.usage.input_tokens;
    totals.output += response.usage.output_tokens;
    totals.cacheRead += response.usage.cache_read_input_tokens ?? 0;
    totals.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;

    if (response.stop_reason === "refusal") {
      throw new RefusalError(
        `The model declined this request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}.`,
      );
    }

    const toolUse = findToolUse(response, opts.tool.name);
    if (!toolUse) {
      lastProblem =
        response.stop_reason === "max_tokens"
          ? "Response hit max_tokens before calling the tool."
          : "No tool call in response.";
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: `You must respond by calling the \`${opts.tool.name}\` tool exactly once. Do not reply in plain text.`,
      });
      continue;
    }

    const parsed = opts.schema.safeParse(toolUse.input);
    if (parsed.success) {
      const usage: UsageRecord = {
        stage: opts.stage,
        model,
        inputTokens: totals.input,
        outputTokens: totals.output,
        cacheReadTokens: totals.cacheRead,
        cacheWriteTokens: totals.cacheWrite,
        latencyMs: Date.now() - started,
        attempts: attempt,
      };
      opts.onUsage?.(usage);
      return { data: parsed.data, attempts: attempt, usage };
    }

    // Repair turn: hand the zod error back as a tool_result error (append-only history).
    lastProblem = formatZodError(parsed.error);
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Your tool input failed validation:\n${lastProblem}\n\nCall \`${opts.tool.name}\` again with corrected input. Keep everything that was valid.`,
        },
      ],
    });
  }

  throw new StructuredOutputError(
    `Stage "${opts.stage}" did not return valid structured output after ${MAX_ATTEMPTS} attempts.`,
    lastProblem,
  );
}
