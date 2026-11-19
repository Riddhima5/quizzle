/**
 * zod schemas for API REQUEST bodies (and shared enums).
 * Schemas for LLM OUTPUTS live next to their prompts in /prompts, so each prompt file
 * owns its tool JSON-schema and the zod validator that checks it.
 */
import { z } from "zod";
import { COUNT_MAX, COUNT_MIN, NOTES_MAX_CHARS, NOTES_MIN_CHARS } from "./constants";

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export const DifficultySettingSchema = z.enum(["easy", "medium", "hard", "mixed"]);
export const BloomSchema = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);
export const QuestionTypeSchema = z.enum(["mcq", "short", "flashcard"]);

export const NotesSchema = z
  .string()
  .trim()
  .min(NOTES_MIN_CHARS, `Notes must be at least ${NOTES_MIN_CHARS} characters.`)
  .max(NOTES_MAX_CHARS, `Notes must be at most ${NOTES_MAX_CHARS.toLocaleString()} characters.`);

export const QuizSettingsSchema = z.object({
  types: z
    .array(QuestionTypeSchema)
    .min(1, "Pick at least one question type.")
    .transform((t) => [...new Set(t)]),
  countPerType: z.number().int().min(COUNT_MIN).max(COUNT_MAX),
  difficulty: DifficultySettingSchema,
  focus: z
    .string()
    .trim()
    .max(200, "Focus topic must be at most 200 characters.")
    .optional()
    .transform((f) => (f ? f : undefined)),
});

export type QuizSettingsInput = z.input<typeof QuizSettingsSchema>;
