/**
 * Writes the final prompts as plain-text templates (for the prompt sheets and the repo's
 * prompts/final/ folder). Variables are shown in {curly brackets}.
 *
 * Run: npx tsx scripts/export-prompts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MessageParam } from "@/lib/anthropic";
import * as gen from "@/prompts/generate";
import * as tr from "@/prompts/transcribeImage";
import * as ver from "@/prompts/verify";

const textOf = (messages: MessageParam[]) =>
  messages
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : (m.content ?? [])
            .map((b) => (b.type === "text" ? b.text : b.type === "image" ? "{image}" : ""))
            .join("\n\n"),
    )
    .join("\n\n");

function sheet(
  title: string,
  version: string,
  temperature: number,
  model: string,
  vars: string,
  built: { system: string; messages: MessageParam[] },
): string {
  return `# ${title}
# Version: ${version}
# Tool and model: Groq, ${model}
# Temperature: ${temperature}
# Variables: ${vars}

## System prompt
${built.system}

## User prompt template
${textOf(built.messages)}
`;
}

const files: Record<string, string> = {
  "P1_transcribe.txt": sheet(
    "P1 Transcribe — photo of notes → text",
    tr.PROMPT_VERSION,
    tr.TEMPERATURE,
    "qwen/qwen3.8-27b (vision)",
    "{image} = one uploaded photo of notes (sent as an image, before the text)",
    tr.buildTranscribeImagePrompt({ mediaType: "image/jpeg", base64: "" } as Parameters<
      typeof tr.buildTranscribeImagePrompt
    >[0]),
  ),
  "P2_generate.txt": sheet(
    "P2 Generate — notes → MCQs, short answers, flashcards",
    gen.PROMPT_VERSION,
    gen.TEMPERATURE,
    "openai/gpt-oss-120b",
    "{notes} = the student's notes; the <request> block is filled from the chosen settings (shown here: 5 MCQs, medium)",
    gen.buildGeneratePrompt("{notes}", { types: ["mcq"], countPerType: 5, difficulty: "medium" }),
  ),
  "P3_verify.txt": sheet(
    "P3 Verify — re-answer every question without the answer key",
    ver.PROMPT_VERSION,
    ver.TEMPERATURE,
    "openai/gpt-oss-120b",
    "{notes} = the same notes; {questions} = the generated questions with answers removed",
    ver.buildVerifyPrompt("{notes}", []),
  ),
};
files["P3_verify.txt"] = files["P3_verify.txt"]!.replace(
  "<questions>\n\n</questions>",
  "<questions>\n{questions}\n</questions>",
);

const dir = join(process.cwd(), "prompts", "final");
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
// v3 of the generation prompt is the final one.
mkdirSync(join(process.cwd(), "prompts", "v3"), { recursive: true });
writeFileSync(
  join(process.cwd(), "prompts", "v3", "generate.txt"),
  `# v3 — Quiz generation (final)
# Changed from v2: forced tool call with a JSON schema (+ zod check and one repair retry), XML tags,
# 1 good example per type + 1 bad example, Bloom's difficulty guide, distractor rules,
# verbatim source_quote first in every item, temperature 0.7.
# Why: v2 relied on the model choosing to return clean JSON (nothing enforced or checked it), its
# questions had no link back to the notes, and difficulty was not controlled.

` + files["P2_generate.txt"]!,
);
console.log(
  `Wrote ${Object.keys(files).length} prompts to prompts/final/ and prompts/v3/generate.txt`,
);
