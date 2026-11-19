import { callTool } from "./anthropic";
import { shuffle } from "./shuffle";
import type { Flashcard, MCQ, Quiz, QuizItem, QuizSettings, ShortAnswer } from "./types";
import { newId } from "./utils";
import {
  buildGeneratePrompt,
  EFFORT as GEN_EFFORT,
  TEMPERATURE as GEN_TEMPERATURE,
  GenerateOutputSchema,
  PROMPT_VERSION as GEN_VERSION,
  TOOL as GEN_TOOL,
  type GenerateOutput,
} from "@/prompts/generate";
import {
  buildVerifyPrompt,
  EFFORT as VERIFY_EFFORT,
  TEMPERATURE as VERIFY_TEMPERATURE,
  PROMPT_VERSION as VERIFY_VERSION,
  TOOL as VERIFY_TOOL,
  VerifyOutputSchema,
  type VerifyOutput,
} from "@/prompts/verify";
import { judge, toBlind } from "./verify";

/** Convert raw model output into app items. MCQ options are shuffled here, in code. */
export function toItems(out: GenerateOutput, settings: QuizSettings): QuizItem[] {
  const n = settings.countPerType;
  const want = (t: string) => settings.types.includes(t as QuizSettings["types"][number]);
  const pending = { status: "unverified" as const };

  const mcqs: MCQ[] = want("mcq")
    ? out.mcqs.slice(0, n).map((m) => ({
        id: newId("mcq"),
        type: "mcq",
        question: m.question,
        options: shuffle([
          { text: m.correct_answer, isCorrect: true },
          ...m.distractors.map((text) => ({ text, isCorrect: false })),
        ]),
        explanation: m.explanation,
        difficulty: m.difficulty,
        bloom: m.bloom,
        sourceQuote: m.source_quote,
        concept: m.concept,
        verification: pending,
      }))
    : [];

  const shorts: ShortAnswer[] = want("short")
    ? out.short_answers.slice(0, n).map((s) => ({
        id: newId("sa"),
        type: "short",
        question: s.question,
        referenceAnswer: s.reference_answer,
        keyPoints: s.key_points,
        difficulty: s.difficulty,
        bloom: s.bloom,
        sourceQuote: s.source_quote,
        concept: s.concept,
        verification: pending,
      }))
    : [];

  const cards: Flashcard[] = want("flashcard")
    ? out.flashcards.slice(0, n).map((f) => ({
        id: newId("fc"),
        type: "flashcard",
        front: f.front,
        back: f.back,
        difficulty: f.difficulty,
        sourceQuote: f.source_quote,
        concept: f.concept,
        verification: pending,
      }))
    : [];

  return [...mcqs, ...shorts, ...cards];
}

export async function generateQuiz(notes: string, settings: QuizSettings): Promise<Quiz> {
  const { data } = await callTool({
    stage: "generate",
    ...buildGeneratePrompt(notes, settings),
    tool: GEN_TOOL,
    schema: GenerateOutputSchema,
    effort: GEN_EFFORT,
    temperature: GEN_TEMPERATURE,
    maxTokens: 32000,
  });
  const generated = toItems(data, settings);
  const { items, dropped } = await verifyItems(notes, generated);

  return {
    id: newId("quiz"),
    title: data.title,
    createdAt: new Date().toISOString(),
    settings,
    items,
    stats: {
      generated: generated.length,
      verified: items.filter((i) => i.verification.status === "verified").length,
      fixed: 0,
      dropped,
    },
    promptVersions: { generate: GEN_VERSION, verify: VERIFY_VERSION },
  };
}

/** Second call: blind re-answering. Matching items are ✅ verified; mismatches are dropped. */
export async function verifyItems(
  notes: string,
  items: readonly QuizItem[],
): Promise<{ items: QuizItem[]; dropped: number }> {
  if (items.length === 0) return { items: [], dropped: 0 };
  let answers: VerifyOutput["answers"];
  try {
    const { data } = await callTool({
      stage: "verify",
      ...buildVerifyPrompt(notes, toBlind(items)),
      tool: VERIFY_TOOL,
      schema: VerifyOutputSchema,
      effort: VERIFY_EFFORT,
      temperature: VERIFY_TEMPERATURE,
      maxTokens: 16000,
    });
    answers = data.answers;
  } catch (error) {
    // Don't throw away a good generation because the checker failed — show items, flagged.
    console.error("[verify] failed, returning unverified items", error);
    return { items: [...items], dropped: 0 };
  }

  const byId = new Map(answers.map((a) => [a.id, a]));
  const kept: QuizItem[] = [];
  for (const item of items) {
    const verdict = judge(item, byId.get(item.id));
    if (!verdict.ok) continue;
    kept.push(
      item.type === "mcq"
        ? { ...item, verification: { status: "verified", verifierAnswer: verdict.verifierAnswer } }
        : { ...item, verification: { status: "verified" } },
    );
  }
  return { items: kept, dropped: items.length - kept.length };
}
