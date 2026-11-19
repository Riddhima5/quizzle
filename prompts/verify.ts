/**
 * PROMPT — Independent answer verifier (one call for the whole quiz)
 * ------------------------------------------------------------------
 * Techniques used:
 *  1. Independent second pass ("blind re-answering") — the verifier sees the notes and the
 *     questions/options but NOT the answer key, so it can't simply agree with the generator.
 *     The comparison with the generator's answer happens in code (lib/verify.ts).
 *  2. Role prompting — a strict, sceptical examiner who answers only from the notes.
 *  3. XML tagging — <notes> and <questions>, with each question in its own tag carrying an id.
 *  4. Evidence before answer — the schema asks for `quote` before `answer`, so the model locates
 *     support in the notes first (a lightweight chain-of-evidence).
 *  5. Explicit abstention — `answerable: false` when the notes don't support exactly one answer
 *     (ambiguous items, two defensible options, or answers that need outside knowledge).
 *  6. Forced tool use (`submit_answers`) + zod validation + one retry.
 *  7. Temperature 0 — checking should be deterministic, not creative.
 */
import { z } from "zod";
import type { Effort, MessageParam, ToolDef } from "@/lib/anthropic";

export const PROMPT_VERSION = "verify@1.0.0";
/** Low: re-answering from given notes is a reading task, and it keeps the second call fast. */
export const EFFORT: Effort = "low";
export const TEMPERATURE = 0;

export const VerifyOutputSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string().min(1),
      quote: z.string(),
      answerable: z.boolean(),
      answer: z.string(),
    }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifyOutputSchema>;

export const TOOL: ToolDef = {
  name: "submit_answers",
  description: "Submit your own answer to every question, with supporting evidence from the notes.",
  input_schema: {
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The question id, exactly as given." },
            quote: {
              type: "string",
              description:
                "Verbatim sentence(s) from the notes that support your answer. Empty if none.",
            },
            answerable: {
              type: "boolean",
              description:
                "False if the notes don't support exactly one correct answer (ambiguous, two defensible options, or needs outside knowledge).",
            },
            answer: {
              type: "string",
              description:
                "MCQ: the single option letter (A, B, C or D). Other types: a one-sentence answer using the notes' own terms.",
            },
          },
          required: ["id", "quote", "answerable", "answer"],
          additionalProperties: false,
        },
      },
    },
    required: ["answers"],
    additionalProperties: false,
  },
};

/** What the verifier is allowed to see — note: no correct answer, no reference answer. */
export type BlindQuestion =
  | { id: string; type: "mcq"; question: string; options: string[] }
  | { id: string; type: "short"; question: string }
  | { id: string; type: "flashcard"; prompt: string };

export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

const SYSTEM = `You are a strict, independent examiner checking a quiz before students see it. You have NOT seen the answer key.

Answer every question yourself using ONLY the notes provided. Do not use outside knowledge. If the notes don't clearly support exactly one answer, say so by marking the question as not answerable — flagging a bad question is more useful than guessing.`;

function renderQuestion(q: BlindQuestion): string {
  if (q.type === "mcq") {
    const opts = q.options.map((o, i) => `${LETTERS[i]}) ${o}`).join("\n");
    return `<question id="${q.id}" type="mcq">\n${q.question}\n${opts}\n</question>`;
  }
  if (q.type === "short") return `<question id="${q.id}" type="short">\n${q.question}\n</question>`;
  return `<question id="${q.id}" type="flashcard">\nWhat goes on the back of this card? ${q.prompt}\n</question>`;
}

export function buildVerifyPrompt(
  notes: string,
  questions: readonly BlindQuestion[],
): { system: string; messages: MessageParam[] } {
  const user = `<notes>
${notes}
</notes>

<questions>
${questions.map(renderQuestion).join("\n\n")}
</questions>

For each question:
1. Find the sentence(s) in the notes that answer it and copy them into "quote".
2. Answer it yourself:
   - mcq: give only the letter of the single best option.
   - short / flashcard: answer in one sentence, reusing the key terms from the notes.
3. Set "answerable" to false if the notes don't contain the answer, if more than one MCQ option is defensible, or if the question is ambiguous.

Answer every question id exactly once, then call the submit_answers tool.`;

  return { system: SYSTEM, messages: [{ role: "user", content: user }] };
}
