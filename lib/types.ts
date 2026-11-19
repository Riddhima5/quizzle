/**
 * Core domain types for Quizzle. Shared by client and server.
 * Runtime validation lives in lib/schemas.ts (zod); these are the static shapes.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type DifficultySetting = Difficulty | "mixed";
export type Bloom = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
/** "unverified" = the verifier call itself failed, so items are shown but flagged. */
export type VerifyStatus = "verified" | "fixed" | "dropped" | "unverified";
export type QuestionType = "mcq" | "short" | "flashcard";

export interface MCQOption {
  text: string;
  isCorrect: boolean;
  whyWrong?: string;
}

export interface MCQ {
  id: string;
  type: "mcq";
  question: string;
  options: MCQOption[];
  explanation: string;
  difficulty: Difficulty;
  bloom: Bloom;
  sourceQuote: string;
  concept: string;
  verification: { status: VerifyStatus; verifierAnswer?: string; notes?: string };
}

export interface ShortAnswer {
  id: string;
  type: "short";
  question: string;
  referenceAnswer: string;
  keyPoints: string[];
  difficulty: Difficulty;
  bloom: Bloom;
  sourceQuote: string;
  concept: string;
  verification: { status: VerifyStatus; notes?: string };
}

export interface Flashcard {
  id: string;
  type: "flashcard";
  front: string;
  back: string;
  difficulty: Difficulty;
  sourceQuote: string;
  concept: string;
  verification: { status: VerifyStatus; notes?: string };
}

export type QuizItem = MCQ | ShortAnswer | Flashcard;

export interface QuizSettings {
  types: QuestionType[];
  countPerType: number;
  difficulty: DifficultySetting;
  focus?: string;
}

export interface QuizStats {
  generated: number;
  verified: number;
  fixed: number;
  dropped: number;
}

export interface Quiz {
  id: string;
  title: string;
  createdAt: string;
  settings: QuizSettings;
  items: QuizItem[];
  stats: QuizStats;
  promptVersions: Record<string, string>;
}

/** Bloom levels allowed for each difficulty tier (Section 2.2). */
export const BLOOM_BY_DIFFICULTY: Record<Difficulty, readonly Bloom[]> = {
  easy: ["remember", "understand"],
  medium: ["apply", "analyze"],
  hard: ["evaluate", "create"],
} as const;

/** Pipeline stages streamed to the client over SSE. */
export type PipelineStage = "extracting" | "generating" | "distractors" | "verifying" | "done";

/** Image transcription result (Section 3.2a). */
export type ContentType = "handwritten" | "printed" | "whiteboard" | "slide" | "mixed";
export type Legibility = "good" | "fair" | "poor";

export interface ImageTranscription {
  order: number;
  transcription: string;
  contentType: ContentType;
  legibility: Legibility;
  hasDiagrams: boolean;
  illegibleCount: number;
}
