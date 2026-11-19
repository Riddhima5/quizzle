/**
 * PROMPT — Quiz generation (one call → all MCQs, short answers and flashcards)
 * ------------------------------------------------------------------
 * Techniques used:
 *  1. Role prompting — system prompt casts the model as an expert educator whose items must be
 *     answerable ONLY from the notes (grounding constraint stated up front).
 *  2. XML tagging — <notes>, <request>, <difficulty_guide>, <rules>, <examples> separate data from
 *     instructions, so note content can't be mistaken for instructions.
 *  3. Long-context ordering — the (possibly long) notes come first, instructions after them.
 *  4. Few-shot — one good example per question type + one annotated bad example (prompts/fewshot.ts),
 *     on a neutral subject so examples don't leak into the output.
 *  5. Bloom's taxonomy mapping — difficulty is defined by cognitive level, not by vagueness; Mixed
 *     is converted to exact per-difficulty counts in code so the model doesn't have to do maths.
 *  6. Distractor design rules — misconceptions / related concepts from the notes, similar length
 *     and grammatical form, no "all/none of the above".
 *  7. Evidence-first schema — `source_quote` is the first field of every item, so the model picks a
 *     verbatim passage before writing the question (grounding by construction).
 *  8. Forced tool use — the model must call `submit_quiz` (Gemini: function-calling mode ANY with
 *     allowedFunctionNames). Its JSON schema shapes the output; zod validates it, and on failure the
 *     error is sent back as the function response for one retry (lib/gemini.ts).
 *  9. Option order is NOT left to the model: MCQ options are shuffled in code (lib/shuffle.ts).
 * 10. Temperature 0.7 — some variety in question wording; grounding rules keep it factual.
 */
import { z } from "zod";
import type { Effort, MessageParam, ToolDef } from "@/lib/anthropic";
import { BloomSchema, DifficultySchema } from "@/lib/schemas";
import type { Difficulty, QuizSettings } from "@/lib/types";
import { BAD_EXAMPLE, EXAMPLE_NOTES, GOOD_EXAMPLES } from "./fewshot";

export const PROMPT_VERSION = "generate@1.0.0";
export const EFFORT: Effort = "medium";
export const TEMPERATURE = 0.7;

// ---------- Output schema ----------

const Text = z.string().trim().min(1);

const McqOut = z.object({
  source_quote: Text,
  concept: Text,
  difficulty: DifficultySchema,
  bloom: BloomSchema,
  question: Text,
  correct_answer: Text,
  distractors: z.array(Text).length(3, "Each MCQ needs exactly 3 distractors."),
  explanation: Text,
});
const ShortOut = z.object({
  source_quote: Text,
  concept: Text,
  difficulty: DifficultySchema,
  bloom: BloomSchema,
  question: Text,
  reference_answer: Text,
  key_points: z.array(Text).min(1),
});
const FlashOut = z.object({
  source_quote: Text,
  concept: Text,
  difficulty: DifficultySchema,
  front: Text,
  back: Text,
});

export const GenerateOutputSchema = z.object({
  title: Text,
  mcqs: z.array(McqOut),
  short_answers: z.array(ShortOut),
  flashcards: z.array(FlashOut),
});
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

const str = (description: string) => ({ type: "string", description });
const difficulty = { type: "string", enum: ["easy", "medium", "hard"] };
const bloom = {
  type: "string",
  enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
};
const grounding = {
  source_quote: str("Verbatim sentence(s) copied from the notes that this item is based on."),
  concept: str("The key concept this item tests (2-6 words)."),
  difficulty,
};
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const TOOL: ToolDef = {
  name: "submit_quiz",
  description:
    "Submit the complete quiz. Use empty arrays for question types that were not requested.",
  input_schema: {
    type: "object",
    properties: {
      title: str("Short quiz title describing the notes' topic (max 8 words)."),
      mcqs: {
        type: "array",
        items: obj({
          ...grounding,
          bloom,
          question: str("The question stem."),
          correct_answer: str("The single correct option."),
          distractors: {
            type: "array",
            items: { type: "string" },
            description: "Exactly 3 plausible wrong options.",
          },
          explanation: str("1-2 sentences: why the answer is correct, citing the notes."),
        }),
      },
      short_answers: {
        type: "array",
        items: obj({
          ...grounding,
          bloom,
          question: str("The question."),
          reference_answer: str("A model answer in 1-3 sentences."),
          key_points: {
            type: "array",
            items: { type: "string" },
            description: "2-4 key points a full answer must contain.",
          },
        }),
      },
      flashcards: {
        type: "array",
        items: obj({ ...grounding, front: str("Term or prompt."), back: str("Concise answer.") }),
      },
    },
    required: ["title", "mcqs", "short_answers", "flashcards"],
    additionalProperties: false,
  },
};

// ---------- Prompt ----------

const SYSTEM = `You are an expert university educator who writes high-quality exam questions from a student's own lecture notes.

Every item you write must be answerable using ONLY the information in the notes — never rely on outside knowledge, even if you know more about the topic. If the notes don't support a question, don't ask it.`;

const DIFFICULTY_GUIDE = `<difficulty_guide>
- easy → Bloom "remember" or "understand": definitions, direct recall, facts stated in the notes, explaining an idea in other words.
- medium → Bloom "apply" or "analyze": use a concept in a new situation, compare/contrast, explain why or how.
- hard → Bloom "evaluate" or "create": multi-step reasoning, edge cases, judging between options, or combining 2+ concepts from the notes.
Set each item's "difficulty" and a matching "bloom" level.
</difficulty_guide>`;

const RULES = `<rules>
Grounding
- Every item must be answerable from the notes alone. Copy "source_quote" verbatim from the notes (a sentence or two, not paraphrased).
- Spread items across different concepts in the notes; don't test the same fact twice.

Questions
- Each question must have exactly one unambiguously correct answer.
- Questions must be self-contained (don't say "according to the notes" or "in the passage").
- No "all of the above" / "none of the above". Avoid negatively phrased questions ("Which is NOT…") unless the item is hard, and then write NOT in capitals.

MCQ distractors (exactly 3)
- Plausible but clearly wrong according to the notes: common misconceptions, related-but-different concepts from the same notes, or partial truths.
- Similar length and the same grammatical form as the correct answer, so the longest or most detailed option is not a giveaway.
- Don't put option letters in the text; the app shuffles the options.

Short answers: a concise model answer plus 2-4 key points the grader should look for.
Flashcards: short front (term or prompt), concise back (the answer), one idea per card.
</rules>`;

function difficultySplit(count: number, setting: QuizSettings["difficulty"]): string {
  if (setting !== "mixed") return `all ${setting}`;
  const easy = Math.round(count * 0.3);
  const hard = Math.round(count * 0.3);
  const medium = count - easy - hard;
  const parts: [number, Difficulty][] = [
    [easy, "easy"],
    [medium, "medium"],
    [hard, "hard"],
  ];
  return parts
    .filter(([n]) => n > 0)
    .map(([n, d]) => `${n} ${d}`)
    .join(", ");
}

export function buildGeneratePrompt(
  notes: string,
  settings: QuizSettings,
): { system: string; messages: MessageParam[] } {
  const n = settings.countPerType;
  const want = (t: QuizSettings["types"][number]) => settings.types.includes(t);
  const line = (label: string, on: boolean) =>
    on
      ? `- ${label}: ${n} (${difficultySplit(n, settings.difficulty)})`
      : `- ${label}: 0 (return an empty array)`;

  const request = `<request>
${line("Multiple-choice questions (mcqs)", want("mcq"))}
${line("Short-answer questions (short_answers)", want("short"))}
${line("Flashcards (flashcards)", want("flashcard"))}
${
  settings.focus
    ? `- Focus: only use material about "${settings.focus}". If the notes cover it only briefly, write fewer items rather than going off-topic.`
    : "- Focus: cover the notes broadly, prioritising the most important concepts."
}
</request>`;

  const examples = `<examples>
These examples use different notes from the student's, to show the expected quality and format. Do not reuse their content.

<example_notes>
${EXAMPLE_NOTES}
</example_notes>

${GOOD_EXAMPLES}

${BAD_EXAMPLE}
</examples>`;

  const user = `<notes>
${notes}
</notes>

Write a quiz from the notes above.

${request}

${DIFFICULTY_GUIDE}

${RULES}

${examples}

Respond by calling the submit_quiz tool exactly once.`;

  return { system: SYSTEM, messages: [{ role: "user", content: user }] };
}
