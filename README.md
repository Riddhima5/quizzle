# Quizzle

**Turn your notes into quizzes — verified.**

Quizzle turns lecture notes (pasted text, a PDF, or photos of handwritten or printed notes) into multiple-choice questions, short-answer questions and flashcards. A second, independent AI pass then re-answers every question from the notes alone and removes any item whose answer it can't reproduce, so you only practise on questions that are actually supported by your material.

**Live prototype:** https://quizzle-self.vercel.app

## Team Byte Belles (PE-B01-41)

Prompt Engineering mini project (SCSE4041), Bennett University · Faculty: Dr. Sonal Kukreja

| Member | Enrollment no. |
| --- | --- |
| Riddhima Srivastava (leader) | S24CSEU0137 |
| Vanshita Yadav | S24CSEU0167 |
| Sanjana Kumari | S24CSEU0395 |
| Palak | S24CSEU0201 |
| Anubhuti Singh | S24CSEU0369 |

## Repository map

| Folder | What's in it |
| --- | --- |
| `prompts/` | Prompt code used by the app (`generate.ts`, `verify.ts`, `transcribeImage.ts`, `fewshot.ts`) |
| `prompts/v1/`, `prompts/v2/`, `prompts/v3/` | The three saved versions of the quiz-generation prompt |
| `prompts/final/` | The 3 final prompts as plain text (P1 transcribe, P2 generate, P3 verify) |
| `app/`, `components/`, `lib/` | Application code (Next.js UI, API routes, pipeline) |
| `test-data/` | Test inputs, the Milestone 2 test-table results and the prompt iteration results |
| `docs/` | Diagrams and the Milestone 2 PDF |
| `scripts/` | Prompt experiment scripts (`prompt-iterations.ts`, `export-prompts.ts`) |
| `CHANGELOG.md` | Dated list of changes since Milestone 1 |

## Features

- **Three ways in:** paste notes, upload a PDF (scanned PDFs can be read as photos), or upload/take photos of notes. Photos are converted, resized and transcribed, and unreadable words are marked `[illegible]` for you to fix.
- **Three question types:** MCQs, short answers and flashcards, 1–20 of each.
- **Difficulty mapped to Bloom's taxonomy:** Easy, Medium, Hard or Mixed.
- **Verified answers:** every item shows a ✅ Verified badge and a source quote from your notes.
- **Quiz modes:** MCQs with a score and explanations, short answers with "Reveal answer", flip-card flashcards.

## Tech stack

| Area       | Tools                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router), React 19, TypeScript (strict)                              |
| Styling    | Tailwind CSS 4, Radix UI primitives, lucide icons                                   |
| AI         | **Groq** (default, free tier) · Google Gemini (free tier) · Anthropic Claude (paid) |
| Validation | zod (every AI output and API request)                                               |
| Files      | unpdf (PDF text), pdfjs-dist, heic2any, browser-image-compression, dnd-kit          |
| Quality    | vitest, ESLint, Prettier                                                            |

## Setup

Requires **Node.js 20+**.

1. Get a free Groq API key at [console.groq.com/keys](https://console.groq.com/keys). No credit card is needed.
2. Install, configure and run:

```bash
npm install
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
# open .env.local and paste your key after GROQ_API_KEY=
npm run dev                    # http://localhost:3000
```

Restart `npm run dev` after editing `.env.local`. Keys are only read on the server and never sent to the browser.

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

### Environment variables

The provider is picked automatically: **Groq** if `GROQ_API_KEY` is set, otherwise Gemini. Set `LLM_PROVIDER` to force one.

| Variable                | Default                                              | Purpose                                        |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `GROQ_API_KEY`          | —                                                    | Groq key (recommended)                         |
| `GROQ_MODEL`            | `openai/gpt-oss-120b`                                | Text model for writing and checking questions  |
| `GROQ_VISION_MODEL`     | `qwen/qwen3.8-27b`                                   | Model for reading photos                       |
| `GEMINI_API_KEY`        | —                                                    | Gemini key (alternative)                       |
| `GEMINI_MODEL`          | `gemini-3.8-flash`                                   | Gemini model                                   |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash` | Tried in order when Gemini is overloaded (503) |
| `LLM_PROVIDER`          | auto                                                 | `groq`, `gemini` or `anthropic`                |
| `ANTHROPIC_API_KEY`     | —                                                    | Only for `LLM_PROVIDER=anthropic` (paid)       |

Free tiers have rate limits that change over time; check your provider's console. A quiz uses 2 requests, plus 1 per photo.

## How it works

```
notes / PDF text / photo transcription (vision model, 1 call per photo)
        │
        ▼
[1] generate  ── prompts/generate.ts ──►  MCQs + short answers + flashcards  (1 call)
        │            options shuffled in code
        ▼
[2] verify    ── prompts/verify.ts   ──►  blind re-answer of every item      (1 call)
        │            compared with the generator's answers in code
        ▼
quiz: ✅ verified items only, plus "X questions removed by verifier"
```

| Path                                     | What's there                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `prompts/`                               | One file per prompt (builder + `PROMPT_VERSION` + tool schema + zod validator), with technique notes |
| `prompts/fewshot.ts`                     | Few-shot examples on a neutral subject (cell biology)                                                |
| `lib/anthropic.ts`                       | `callTool()` entry point; picks the provider; also the Claude backend                                |
| `lib/groq.ts`, `lib/gemini.ts`           | Groq and Gemini backends: forced tool call → zod validation → one repair retry                       |
| `lib/retry.ts`                           | Exponential backoff on rate limits / overload / 5xx                                                  |
| `lib/pipeline.ts`, `lib/verify.ts`       | Generate → shuffle → verify → compare                                                                |
| `components/upload/`, `components/quiz/` | Input form and quiz screens                                                                          |

## Prompt design

- **XML tags.** Notes go in `<notes>`; instructions in `<request>`, `<difficulty_guide>`, `<rules>` and `<examples>`, so text in the notes is never treated as a command. Notes come first, instructions after.
- **Few-shot examples.** One good example per question type plus one annotated bad example, on a neutral subject so they don't leak into quizzes.
- **Bloom's taxonomy.** Easy = remember/understand, Medium = apply/analyze, Hard = evaluate/create. "Mixed" is converted in code into exact counts (about 30/40/30).
- **Distractor design.** 3 plausible wrong options from misconceptions, related concepts or partial truths, similar in length to the answer; no "all/none of the above". Options are shuffled in code.
- **Evidence first.** Every item starts with a verbatim `source_quote`, shown to students as "Source".
- **Forced tool use.** Each call must answer through one function with a JSON schema (`submit_quiz`, `submit_answers`, `submit_transcription`). Output is validated with zod and retried once with the error.
- **Independent verifier.** The second call sees the questions but **not the answer key**, answers them itself and can abstain. Code compares answers; mismatches are removed.
- **Temperature per stage.** 0 for transcription and verification, 0.7 for generation (applied on Groq and Gemini; current Claude models reject sampling parameters and use effort levels instead).

## Known limitations

- The short-answer and flashcard check is a word-overlap heuristic, so an unusually worded correct answer can be removed.
- Short answers aren't graded; "Reveal" shows the model answer and key points.
- Free tiers can be rate-limited or busy; the app retries and falls back, but very long notes or many questions may still be slow.
- Nothing is saved: refreshing the page loses the quiz.
