# Changelog

All dates are 2026. Milestone 1 (problem definition, ideation and planning) was submitted before 16 Nov.

## 21 Nov — Milestone 2 documentation and testing
- Ran a 13-case test table (normal, edge and invalid inputs) on the live prototype; inputs and results saved in `test-data/m2-tests/`.
- Added `docs/` with the four Milestone 2 diagrams (prompt workflow, task decomposition, input–output flow, system architecture) and the Milestone 2 PDF.
- README: added team members, live prototype link and a repository map.

## 19 Nov — Prompt iteration experiment
- Saved three versions of the quiz-generation prompt in `prompts/v1/`, `prompts/v2/`, `prompts/v3/`.
- Exported the 3 final prompts as plain text to `prompts/final/` (`scripts/export-prompts.ts`).
- Ran 5 runs per version on the same notes (`scripts/prompt-iterations.ts`); results in `test-data/prompt-iterations/RESULTS.md` (v1 0/5 usable → v2 5/5 → v3 5/5, 25/25 verified).

## 19 Nov — Working prototype deployed
- Built the Next.js app: paste / PDF / photo input, quiz settings, generation, verification and the quiz UI.
- Three-prompt pipeline: P1 transcribe (photos), P2 generate, P3 verify (blind re-answering, mismatches removed in code).
- Groq (openai/gpt-oss-120b, qwen/qwen3.8-27b for photos) as the default provider; Gemini and Claude as backups.
- Deployed to Vercel: https://quizzle-self.vercel.app
