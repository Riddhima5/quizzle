/**
 * PROMPT — Image transcription (Section 3.2a)
 * ------------------------------------------------------------------
 * Turns one photo of study material (handwritten notes, whiteboard, textbook page, slide)
 * into faithful Markdown text that the rest of the pipeline treats exactly like pasted notes.
 *
 * Techniques used:
 *  1. Image-first ordering — the image block precedes the instruction text, which is the
 *     layout Anthropic recommends for vision prompts (the model "reads" before it is told what to do).
 *  2. Role + task framing in the system prompt ("meticulous transcriptionist", not a tutor),
 *     so the model doesn't summarise, explain or correct the notes.
 *  3. Explicit fidelity rules with a calibrated uncertainty marker — `[illegible]` instead of
 *     guessing, and an explicit ban on guessing technical terms. This trades recall for
 *     precision, which matters because every later stage treats the transcript as ground truth.
 *  4. Structure-preserving output spec — headings → #/##, lists, Markdown tables, LaTeX for
 *     equations, `[Diagram: …]` descriptions — so concept extraction can use the structure.
 *  5. Negative instructions for noise (page numbers, watermarks, doodles, desk edges).
 *  6. Structured output via tool use (`submit_transcription`, strict JSON schema) with
 *     enum-constrained metadata (content_type, legibility) that drives UI warnings.
 *  7. Explicit "no content" path — empty transcription for selfies/random photos, rather
 *     than letting the model invent notes.
 *  8. Determinism: temperature 0 (faithful copying, no creativity wanted). Applied on Gemini;
 *     the Claude backend ignores it (current Claude models reject sampling params) and uses low effort.
 */
import { z } from "zod";
import type { Effort, MessageParam, ToolDef } from "@/lib/anthropic";
import type { ServerImageType } from "@/lib/constants";

export const PROMPT_VERSION = "transcribeImage@1.0.0";
export const EFFORT: Effort = "low";
export const TEMPERATURE = 0;

export const TranscriptionOutputSchema = z.object({
  transcription: z.string(),
  content_type: z.enum(["handwritten", "printed", "whiteboard", "slide", "mixed"]),
  legibility: z.enum(["good", "fair", "poor"]),
  has_diagrams: z.boolean(),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

export const TOOL: ToolDef = {
  name: "submit_transcription",
  description:
    "Submit the faithful transcription of the study material in the image, plus metadata about the image.",
  input_schema: {
    type: "object",
    properties: {
      transcription: {
        type: "string",
        description:
          "Markdown transcription of all study content, in reading order. Empty string if the image contains no study content.",
      },
      content_type: {
        type: "string",
        enum: ["handwritten", "printed", "whiteboard", "slide", "mixed"],
        description: "The dominant kind of material in the image.",
      },
      legibility: {
        type: "string",
        enum: ["good", "fair", "poor"],
        description:
          "good = nearly everything readable; fair = some words uncertain; poor = large parts unreadable (blur, glare, angle, faint ink).",
      },
      has_diagrams: {
        type: "boolean",
        description: "True if the image contains any diagram, chart or figure.",
      },
    },
    required: ["transcription", "content_type", "legibility", "has_diagrams"],
    additionalProperties: false,
  },
};

const SYSTEM = `You are a meticulous transcriptionist for university study materials. You convert photos of lecture notes, whiteboards, textbook pages, printed handouts and slides into clean Markdown text.

Your transcript will be used as the ONLY source of truth for generating exam questions, so fidelity matters more than completeness: a wrong word is worse than a marked gap.`;

const INSTRUCTIONS = `Transcribe the study content in this image.

<rules>
Fidelity
- Copy the content exactly as written. Do not summarise, paraphrase, correct, complete or explain anything.
- Do not add information that is not visible in the image.
- If a word or symbol cannot be read with confidence, write [illegible] in its place. Never guess at technical terms, names, numbers or formulas — use [illegible] instead.
- Keep the author's abbreviations and spelling (e.g. "w/", "approx.", "b/c").

Structure
- Headings or titles → Markdown "#" / "##". Underlined or boxed headings count as headings.
- Bullet points → "- ", numbered lists → "1. ". Preserve indentation for nested points.
- Tables → Markdown tables.
- Equations and formulas → inline LaTeX between single dollar signs, e.g. $E = mc^2$.
- Diagrams, charts and figures → one line: [Diagram: <what it shows, including labels, arrows and the relationships they indicate>].
- Arrows used in text (→, ⇒) may be kept as written.
- Follow the natural reading order: top to bottom, left to right, columns one at a time.

Ignore (do not transcribe)
- Page numbers, headers/footers repeated on every page, watermarks, logos, timestamps.
- Doodles, crossed-out text, shadows, fingers, the desk, background objects.

No study content
- If the image contains no study material (e.g. a selfie, a room, a blank page), submit an empty transcription with legibility "poor".
</rules>

Respond by calling the submit_transcription tool exactly once.`;

export interface ImageInput {
  mediaType: ServerImageType;
  base64: string;
}

export function buildTranscribeImagePrompt(image: ImageInput): {
  system: string;
  messages: MessageParam[];
} {
  return {
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          // Image FIRST, then the instruction text.
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
          { type: "text", text: INSTRUCTIONS },
        ],
      },
    ],
  };
}
