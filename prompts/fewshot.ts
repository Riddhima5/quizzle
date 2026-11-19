/**
 * Few-shot examples for prompts/generate.ts.
 * Neutral subject (basic cell biology) so example content doesn't leak into users' quizzes.
 * One good example per question type + one deliberately bad example with the reason it's bad.
 */

export const EXAMPLE_NOTES = `## Cell membrane transport
- Diffusion: movement of molecules from high to low concentration. Requires no energy.
- Osmosis is the diffusion of water across a selectively permeable membrane.
- Active transport moves substances against their concentration gradient and requires ATP.
- The sodium-potassium pump moves 3 Na+ out of the cell and 2 K+ into the cell per ATP.`;

export const GOOD_EXAMPLES = `<good_example type="mcq">
{
  "source_quote": "Active transport moves substances against their concentration gradient and requires ATP.",
  "concept": "Active transport",
  "difficulty": "medium",
  "bloom": "apply",
  "question": "A root cell absorbs nitrate ions even though nitrate is already more concentrated inside the cell than in the soil. Which process must the cell be using?",
  "correct_answer": "Active transport, which uses ATP to move ions against their gradient",
  "distractors": [
    "Diffusion, which moves ions from the soil into the cell without energy",
    "Osmosis, which moves dissolved ions across the membrane with water",
    "The sodium-potassium pump, which moves nitrate ions in exchange for sodium"
  ],
  "explanation": "Moving a substance from low to high concentration is against its gradient, which the notes say requires active transport and ATP."
}
</good_example>
Why it's good: applies a concept to a new situation; each distractor is a real misconception (diffusion direction, osmosis is water-only, the pump moves Na+/K+ not nitrate); all options have similar length and form.

<good_example type="short">
{
  "source_quote": "Osmosis is the diffusion of water across a selectively permeable membrane.",
  "concept": "Osmosis vs diffusion",
  "difficulty": "medium",
  "bloom": "analyze",
  "question": "How is osmosis related to diffusion?",
  "reference_answer": "Osmosis is a special case of diffusion: it is the diffusion of water specifically, across a selectively permeable membrane.",
  "key_points": ["Osmosis is a type of diffusion", "It involves water", "It occurs across a selectively permeable membrane"]
}
</good_example>

<good_example type="flashcard">
{
  "source_quote": "The sodium-potassium pump moves 3 Na+ out of the cell and 2 K+ into the cell per ATP.",
  "concept": "Sodium-potassium pump",
  "difficulty": "easy",
  "front": "Sodium-potassium pump: ions moved per ATP",
  "back": "3 Na+ out of the cell and 2 K+ into the cell"
}
</good_example>`;

export const BAD_EXAMPLE = `<bad_example type="mcq">
{
  "question": "Which of the following are types of membrane transport?",
  "correct_answer": "All of the above",
  "distractors": ["Diffusion", "Endocytosis", "Osmosis"]
}
</bad_example>
Why it's bad: "All of the above" is banned, "Endocytosis" is not in the notes, and more than one option is defensible, so the question has no single correct answer.`;
