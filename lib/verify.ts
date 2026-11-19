/**
 * Code-side comparison of the verifier's blind answers with the generator's answers.
 * MCQ: exact letter match. Short answer / flashcard: content-word overlap with the
 * generator's answer (lenient on wording, since both answers reuse the notes' terms).
 */
import type { QuizItem } from "./types";
import { LETTERS, type BlindQuestion, type VerifyOutput } from "@/prompts/verify";

const STOPWORDS = new Set(
  "the a an and or of to in on for with by is are was were be been it its this that these those as at from into than then which who what when where why how does do can not no".split(
    " ",
  ),
);

export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map((w) => w.replace(/(ies|es|s)$/, "")),
  );
}

/** True when the two free-text answers share enough key terms to count as the same answer. */
export function answersAgree(verifier: string, reference: string): boolean {
  const v = contentWords(verifier);
  const r = contentWords(reference);
  if (v.size === 0 || r.size === 0) return false;
  let shared = 0;
  v.forEach((w) => r.has(w) && shared++);
  return shared >= 4 || shared / Math.min(v.size, r.size) >= 0.4;
}

/** Strip the answer key: the verifier only ever sees these. */
export function toBlind(items: readonly QuizItem[]): BlindQuestion[] {
  return items.map((item) => {
    if (item.type === "mcq") {
      return {
        id: item.id,
        type: "mcq",
        question: item.question,
        options: item.options.map((o) => o.text),
      };
    }
    if (item.type === "short") return { id: item.id, type: "short", question: item.question };
    return { id: item.id, type: "flashcard", prompt: item.front };
  });
}

export interface Verdict {
  ok: boolean;
  verifierAnswer: string;
  note: string;
}

export function judge(
  item: QuizItem,
  answer: VerifyOutput["answers"][number] | undefined,
): Verdict {
  if (!answer) return { ok: false, verifierAnswer: "", note: "Verifier skipped this question." };
  if (!answer.answerable) {
    return {
      ok: false,
      verifierAnswer: answer.answer,
      note: "Verifier: not answerable from the notes.",
    };
  }
  if (item.type === "mcq") {
    const correct = LETTERS[item.options.findIndex((o) => o.isCorrect)];
    const given = answer.answer
      .trim()
      .toUpperCase()
      .match(/^[A-F]/)?.[0];
    return given !== undefined && given === correct
      ? { ok: true, verifierAnswer: given, note: "" }
      : {
          ok: false,
          verifierAnswer: given ?? answer.answer,
          note: `Verifier chose ${given ?? "?"}, key says ${correct}.`,
        };
  }
  const reference =
    item.type === "short" ? `${item.referenceAnswer} ${item.keyPoints.join(" ")}` : item.back;
  return answersAgree(answer.answer, reference)
    ? { ok: true, verifierAnswer: answer.answer, note: "" }
    : { ok: false, verifierAnswer: answer.answer, note: "Verifier's answer didn't match." };
}
