import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  callTool,
  modelCaps,
  RefusalError,
  setMessagesAPIForTests,
  StructuredOutputError,
  type MessagesAPI,
} from "@/lib/anthropic";

type Msg = Anthropic.Beta.Messages.BetaMessage;
type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

function fakeMessage(content: unknown[], stop_reason = "tool_use"): Msg {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "test",
    content,
    stop_reason,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  } as unknown as Msg;
}

const toolUse = (input: unknown) => ({ type: "tool_use", id: "tu_1", name: "submit", input });

const schema = z.object({ answer: z.string().min(1) });
const tool = {
  name: "submit",
  description: "Submit",
  input_schema: {
    type: "object" as const,
    properties: { answer: { type: "string" } },
    required: ["answer"],
    additionalProperties: false,
  },
};

function mockAPI(responses: Msg[]): { api: MessagesAPI; calls: Params[] } {
  const calls: Params[] = [];
  const queue = [...responses];
  const api: MessagesAPI = {
    create: vi.fn(async (params: Params) => {
      calls.push(structuredClone(params));
      const next = queue.shift();
      if (!next) throw new Error("no more responses");
      return next;
    }),
  };
  return { api, calls };
}

const base = {
  stage: "test",
  system: "sys",
  messages: [{ role: "user" as const, content: "hi" }],
  tool,
  schema,
  model: "claude-sonnet-5-5",
};

afterEach(() => setMessagesAPIForTests(null));

describe("modelCaps", () => {
  it("does not force tool_choice on newer models", () => {
    expect(modelCaps("claude-sonnet-5-5").forcedToolChoice).toBe(false);
    expect(modelCaps("claude-opus-5-5").forcedToolChoice).toBe(false);
  });
  it("forces tool_choice on older models and strips date suffixes", () => {
    expect(modelCaps("claude-sonnet-4-5-20250929")).toEqual({
      forcedToolChoice: true,
      effort: false,
    });
    expect(modelCaps("claude-opus-4-8")).toEqual({ forcedToolChoice: true, effort: true });
  });
});

describe("callTool", () => {
  it("returns validated data on the first attempt", async () => {
    const { api, calls } = mockAPI([fakeMessage([toolUse({ answer: "42" })])]);
    setMessagesAPIForTests(api);
    const result = await callTool({ ...base, effort: "low" });
    expect(result.data).toEqual({ answer: "42" });
    expect(result.attempts).toBe(1);
    expect(calls[0]?.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(calls[0]?.tools?.[0]).toMatchObject({ name: "submit", strict: true });
    expect(calls[0]?.output_config).toEqual({ effort: "low" });
    expect(calls[0]).not.toHaveProperty("temperature");
  });

  it("uses forced tool_choice on models that accept it", async () => {
    const { api, calls } = mockAPI([fakeMessage([toolUse({ answer: "x" })])]);
    setMessagesAPIForTests(api);
    await callTool({ ...base, model: "claude-sonnet-4-5" });
    expect(calls[0]?.tool_choice).toEqual({ type: "tool", name: "submit" });
  });

  it("retries once with the zod error appended as a tool_result", async () => {
    const { api, calls } = mockAPI([
      fakeMessage([toolUse({ answer: "" })]),
      fakeMessage([toolUse({ answer: "fixed" })]),
    ]);
    setMessagesAPIForTests(api);
    const result = await callTool(base);
    expect(result.data.answer).toBe("fixed");
    expect(result.attempts).toBe(2);
    const repair = calls[1]?.messages.at(-1);
    expect(repair?.role).toBe("user");
    expect(JSON.stringify(repair?.content)).toContain("failed validation");
    expect(JSON.stringify(repair?.content)).toContain('"is_error":true');
  });

  it("nudges when the model answers in text instead of calling the tool", async () => {
    const { api, calls } = mockAPI([
      fakeMessage([{ type: "text", text: "Sure!" }], "end_turn"),
      fakeMessage([toolUse({ answer: "ok" })]),
    ]);
    setMessagesAPIForTests(api);
    await expect(callTool(base)).resolves.toMatchObject({ attempts: 2 });
    expect(JSON.stringify(calls[1]?.messages.at(-1))).toContain("must respond by calling");
  });

  it("throws StructuredOutputError after two invalid attempts", async () => {
    const { api } = mockAPI([
      fakeMessage([toolUse({ answer: "" })]),
      fakeMessage([toolUse({ nope: 1 })]),
    ]);
    setMessagesAPIForTests(api);
    await expect(callTool(base)).rejects.toBeInstanceOf(StructuredOutputError);
  });

  it("throws RefusalError on a refusal", async () => {
    const { api } = mockAPI([fakeMessage([], "refusal")]);
    setMessagesAPIForTests(api);
    await expect(callTool(base)).rejects.toBeInstanceOf(RefusalError);
  });

  it("aggregates usage across attempts", async () => {
    const { api } = mockAPI([
      fakeMessage([toolUse({ answer: "" })]),
      fakeMessage([toolUse({ answer: "ok" })]),
    ]);
    setMessagesAPIForTests(api);
    const onUsage = vi.fn();
    await callTool({ ...base, onUsage });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "test", inputTokens: 20, outputTokens: 10, attempts: 2 }),
    );
  });
});
