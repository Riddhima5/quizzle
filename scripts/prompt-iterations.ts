/**
 * Prompt iteration experiment: runs v1, v2 and v3 (final) of the quiz-generation prompt on the
 * same notes several times and measures each version. Results feed the iteration log
 * (Milestone 2, Section 3) and the before/after part of the reel.
 *
 * Run:   npx tsx scripts/prompt-iterations.ts            (5 runs per version)
 *        npx tsx scripts/prompt-iterations.ts --runs 10  (more runs, uses more free-tier quota)
 * Needs: GROQ_API_KEY in .env.local
 * Writes: test-data/prompt-iterations/RESULTS.md and raw-<time>.json
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Groq from "groq-sdk";
import { callTool } from "@/lib/anthropic";
import { verifyItems, toItems } from "@/lib/pipeline";
import { withRetry } from "@/lib/retry";
import type { MCQ, QuizItem } from "@/lib/types";
import { newId } from "@/lib/utils";
import * as gen from "@/prompts/generate";

config({ path: ".env.local", quiet: true });

const COUNT = 5;
const MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const runsArg = process.argv.indexOf("--runs");
const RUNS = runsArg > -1 ? Math.max(1, Number(process.argv[runsArg + 1]) || 5) : 5;
const ROOT = process.cwd();
const notes = readFileSync(join(ROOT, "test-data", "sample-notes.txt"), "utf8").trim();

// ---------- the two older versions (same text as prompts/v1 and prompts/v2) ----------

const V1_USER = `Make a quiz with ${COUNT} multiple-choice questions from these notes.\n\n${notes}`;

const V2_SYSTEM = "You are a teacher who writes quiz questions for students.";
const V2_USER = `<notes>
${notes}
</notes>

Write ${COUNT} multiple-choice questions from the notes above.
Only use facts that are in the notes.
Each question must have exactly 4 options and one correct answer.

Return ONLY JSON in this exact format, with no other text:
{"mcqs": [{"question": "...", "options": ["...", "...", "...", "..."], "answer": "exact text of the correct option"}]}`;

// ---------- measurement ----------

interface RunResult {
  version: "v1" | "v2" | "v3";
  run: number;
  parsedDirectly: boolean; // app could read the output with no manual cleanup
  rightCount: boolean; // exactly COUNT questions, 4 options each, answer is one of the options
  allNoneOfAbove: number; // options like "all of the above"
  quotesVerbatim: string; // v3 only: source quotes found word-for-word in the notes
  verified: string; // questions that passed the app's independent verifier
  verifiedCount: number;
  latencySec: number;
  raw: string;
  error?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const ALL_NONE = /\b(all|none|both) of the (above|options)\b/i;

let groqClient: Groq | null = null;
const groq = () => (groqClient ??= new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 }));

async function chat(system: string | null, user: string): Promise<string> {
  const res = await withRetry(() =>
    groq().chat.completions.create({
      model: MODEL,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user", content: user },
      ],
      max_completion_tokens: 4000,
    }),
  );
  return res.choices[0]?.message.content ?? "";
}

function mcqItem(question: string, options: string[], answer: string): MCQ {
  return {
    id: newId("mcq"),
    type: "mcq",
    question,
    options: options.map((text) => ({ text, isCorrect: norm(text) === norm(answer) })),
    explanation: "",
    difficulty: "medium",
    bloom: "remember",
    sourceQuote: "",
    concept: "",
    verification: { status: "unverified" },
  };
}

async function countVerified(items: QuizItem[]): Promise<number> {
  const { items: kept } = await verifyItems(notes, items);
  return kept.length;
}

async function runV1(run: number): Promise<RunResult> {
  const t = Date.now();
  const raw = await chat(null, V1_USER);
  let parsedDirectly = false;
  try {
    JSON.parse(raw.trim());
    parsedDirectly = true;
  } catch {
    /* free text — expected for v1 */
  }
  return {
    version: "v1",
    run,
    parsedDirectly,
    rightCount: false, // can't be checked automatically: no structure to read
    allNoneOfAbove: (raw.match(new RegExp(ALL_NONE, "gi")) ?? []).length,
    quotesVerbatim: "n/a",
    verified: "n/a (not machine-readable)",
    verifiedCount: 0,
    latencySec: (Date.now() - t) / 1000,
    raw,
  };
}

async function runV2(run: number): Promise<RunResult> {
  const t = Date.now();
  const raw = await chat(V2_SYSTEM, V2_USER);
  const base = { version: "v2" as const, run, quotesVerbatim: "n/a", raw };
  let data: { mcqs?: { question?: string; options?: string[]; answer?: string }[] };
  try {
    data = JSON.parse(raw.trim());
  } catch {
    return {
      ...base,
      parsedDirectly: false,
      rightCount: false,
      allNoneOfAbove: (raw.match(new RegExp(ALL_NONE, "gi")) ?? []).length,
      verified: "0/0 (invalid JSON)",
      verifiedCount: 0,
      latencySec: (Date.now() - t) / 1000,
    };
  }
  const mcqs = Array.isArray(data.mcqs) ? data.mcqs : [];
  const wellFormed = mcqs.filter(
    (m) =>
      typeof m.question === "string" &&
      Array.isArray(m.options) &&
      m.options.length === 4 &&
      typeof m.answer === "string" &&
      m.options.some((o) => norm(o) === norm(m.answer!)),
  );
  const items = wellFormed.map((m) => mcqItem(m.question!, m.options!, m.answer!));
  const verifiedCount = await countVerified(items);
  return {
    ...base,
    parsedDirectly: true,
    rightCount: mcqs.length === COUNT && wellFormed.length === COUNT,
    allNoneOfAbove: mcqs.flatMap((m) => m.options ?? []).filter((o) => ALL_NONE.test(o)).length,
    verified: `${verifiedCount}/${mcqs.length}`,
    verifiedCount,
    latencySec: (Date.now() - t) / 1000,
  };
}

async function runV3(run: number): Promise<RunResult> {
  const t = Date.now();
  const settings = { types: ["mcq" as const], countPerType: COUNT, difficulty: "medium" as const };
  const { data, attempts } = await callTool({
    stage: "generate",
    ...gen.buildGeneratePrompt(notes, settings),
    tool: gen.TOOL,
    schema: gen.GenerateOutputSchema,
    temperature: gen.TEMPERATURE,
    effort: gen.EFFORT,
    maxTokens: 32000,
  });
  const items = toItems(data, settings);
  const quotes = data.mcqs.filter((m) => norm(notes).includes(norm(m.source_quote))).length;
  const verifiedCount = await countVerified(items);
  return {
    version: "v3",
    run,
    parsedDirectly: attempts === 1, // valid on the first try, no repair needed
    rightCount: data.mcqs.length === COUNT,
    allNoneOfAbove: data.mcqs
      .flatMap((m) => [m.correct_answer, ...m.distractors])
      .filter((o) => ALL_NONE.test(o)).length,
    quotesVerbatim: `${quotes}/${data.mcqs.length}`,
    verified: `${verifiedCount}/${items.length}`,
    verifiedCount,
    latencySec: (Date.now() - t) / 1000,
    raw: JSON.stringify(data, null, 2),
  };
}

// ---------- main ----------

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing. Add it to .env.local and run again.");
    process.exit(1);
  }
  process.env.LLM_PROVIDER = "groq";
  console.log(`Model ${MODEL} · ${COUNT} MCQs per run · ${RUNS} runs per version\n`);

  const results: RunResult[] = [];
  const runners = { v1: runV1, v2: runV2, v3: runV3 } as const;
  for (const v of ["v1", "v2", "v3"] as const) {
    for (let i = 1; i <= RUNS; i++) {
      process.stdout.write(`${v} run ${i}/${RUNS} … `);
      try {
        const r = await runners[v](i);
        results.push(r);
        console.log(`ok (${r.latencySec.toFixed(1)} s, verified ${r.verified})`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`FAILED: ${msg}`);
        results.push({
          version: v,
          run: i,
          parsedDirectly: false,
          rightCount: false,
          allNoneOfAbove: 0,
          quotesVerbatim: "n/a",
          verified: "0 (run failed)",
          verifiedCount: 0,
          latencySec: 0,
          raw: "",
          error: msg,
        });
      }
    }
  }

  // Summary per version
  const rows = (["v1", "v2", "v3"] as const).map((v) => {
    const rs = results.filter((r) => r.version === v);
    const n = rs.length;
    const asked = n * COUNT;
    const verified = rs.reduce((s, r) => s + r.verifiedCount, 0);
    const quoteRuns = rs.filter((r) => r.quotesVerbatim.includes("/"));
    const quoteOk = quoteRuns.reduce((s, r) => s + Number(r.quotesVerbatim.split("/")[0]), 0);
    const quoteAll = quoteRuns.reduce((s, r) => s + Number(r.quotesVerbatim.split("/")[1]), 0);
    return {
      v,
      parsed: `${rs.filter((r) => r.parsedDirectly).length}/${n}`,
      count: v === "v1" ? "n/a" : `${rs.filter((r) => r.rightCount).length}/${n}`,
      allNone: rs.reduce((s, r) => s + r.allNoneOfAbove, 0),
      quotes: quoteAll ? `${quoteOk}/${quoteAll}` : "n/a",
      verified:
        v === "v1" ? "n/a" : `${verified}/${asked} (${Math.round((verified / asked) * 100)}%)`,
      failed: rs.filter((r) => r.error).length,
      avgSec: (rs.reduce((s, r) => s + r.latencySec, 0) / Math.max(1, n)).toFixed(1),
    };
  });

  const table = [
    '| Version | Output usable by the app (no cleanup) | Exactly 5 well-formed MCQs | "All/none of the above" options | Source quotes word-for-word from notes | Questions passing the verifier | Failed runs | Avg time (s) |',
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.v} | ${r.parsed} | ${r.count} | ${r.allNone} | ${r.quotes} | ${r.verified} | ${r.failed} | ${r.avgSec} |`,
    ),
  ].join("\n");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(ROOT, "test-data", "prompt-iterations");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `raw-${stamp}.json`), JSON.stringify(results, null, 2));

  const sample = (v: string) =>
    results.find((r) => r.version === v && !r.error)?.raw ?? "(no successful run)";
  writeFileSync(
    join(outDir, "RESULTS.md"),
    `# Prompt iteration results

Run on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · model \`${MODEL}\` via Groq · notes: \`test-data/sample-notes.txt\` · ${COUNT} MCQs requested per run · ${RUNS} runs per version.
Prompt texts: \`prompts/v1/generate.txt\`, \`prompts/v2/generate.txt\`, \`prompts/v3/generate.txt\`.

${table}

How each column is measured:
- **Usable by the app**: v1/v2 = the reply is valid JSON as-is; v3 = the forced tool call passed the zod check on the first attempt.
- **Questions passing the verifier**: each question is re-answered by the app's own verifier prompt (P3) without the answer key; it passes only if the verifier finds it answerable from the notes and picks the same answer.
- v1 is free text, so it can't be checked automatically. Read the sample below for what it looks like.

## Sample output — v1
\`\`\`
${sample("v1")}
\`\`\`

## Sample output — v2
\`\`\`
${sample("v2")}
\`\`\`

## Sample output — v3
\`\`\`json
${sample("v3")}
\`\`\`
`,
  );

  console.log(`\n${table}\n\nSaved test-data/prompt-iterations/RESULTS.md and raw-${stamp}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
