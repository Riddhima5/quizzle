import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { setMessagesAPIForTests, type MessagesAPI } from "@/lib/anthropic";
import { transcribeImages, TRANSCRIBE_CONCURRENCY } from "@/lib/transcribe";
import { buildTranscribeImagePrompt, TranscriptionOutputSchema } from "@/prompts/transcribeImage";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

afterEach(() => setMessagesAPIForTests(null));

describe("transcribeImage prompt", () => {
  it("puts the image block before the instruction text", () => {
    const { messages } = buildTranscribeImagePrompt({ mediaType: "image/jpeg", base64: "AAAA" });
    const content = messages[0]?.content;
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content[0]?.type).toBe("image");
    expect(content[1]?.type).toBe("text");
  });

  it("schema rejects unknown enum values", () => {
    const base = {
      transcription: "x",
      content_type: "printed",
      legibility: "good",
      has_diagrams: false,
    };
    expect(TranscriptionOutputSchema.safeParse(base).success).toBe(true);
    expect(TranscriptionOutputSchema.safeParse({ ...base, legibility: "great" }).success).toBe(
      false,
    );
  });
});

describe("transcribeImages", () => {
  it("keeps the user's order, limits concurrency and joins pages", async () => {
    let inFlight = 0;
    let peak = 0;
    const api: MessagesAPI = {
      async create(params: Params) {
        inFlight++;
        peak = Math.max(peak, inFlight);
        const first = params.messages[0]?.content;
        const data =
          Array.isArray(first) && first[0]?.type === "image" && first[0].source.type === "base64"
            ? first[0].source.data
            : "?";
        // Finish out of order: later images resolve sooner.
        await new Promise((r) => setTimeout(r, 30 - Number(data) * 2));
        inFlight--;
        return {
          id: "m",
          type: "message",
          role: "assistant",
          model: "t",
          stop_reason: "tool_use",
          stop_details: null,
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [
            {
              type: "tool_use",
              id: "tu",
              name: "submit_transcription",
              input: {
                transcription: data === "2" ? "" : `page ${data} [illegible]`,
                content_type: "handwritten",
                legibility: data === "3" ? "poor" : "good",
                has_diagrams: false,
              },
            },
          ],
        } as unknown as Anthropic.Beta.Messages.BetaMessage;
      },
    };
    setMessagesAPIForTests(api);

    const images = Array.from({ length: 6 }, (_, i) => ({
      mediaType: "image/jpeg" as const,
      base64: String(i),
    }));
    const { pages, combined } = await transcribeImages(images);

    expect(peak).toBeLessThanOrEqual(TRANSCRIBE_CONCURRENCY);
    expect(pages.map((p) => p.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pages[3]?.legibility).toBe("poor");
    expect(pages[0]?.illegibleCount).toBe(1);
    expect(combined.startsWith("--- Page 1 ---\npage 0")).toBe(true);
    expect(combined).not.toContain("--- Page 3 ---"); // empty page skipped
    expect(combined).toContain("--- Page 4 ---\npage 3");
  });
});
