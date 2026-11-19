"use client";

import { useId } from "react";
import {
  Check,
  Flower2,
  Layers,
  Leaf,
  ListChecks,
  Minus,
  PenLine,
  Plus,
  Sprout,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import { IconChip } from "@/components/ui/icon-chip";
import { Input, Label } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { COUNT_MAX, COUNT_MIN } from "@/lib/constants";
import type { DifficultySetting, QuestionType, QuizSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: { value: QuestionType; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "mcq", label: "Multiple choice", hint: "4 options, one correct", icon: ListChecks },
  { value: "short", label: "Short answer", hint: "Write it, then compare", icon: PenLine },
  { value: "flashcard", label: "Flashcards", hint: "Flip to recall", icon: Layers },
];

/** Difficulty as a growth scale: sprout → leaf → tree (plus a bouquet for "mixed"). */
const DIFFICULTIES: {
  value: DifficultySetting;
  label: string;
  bloom: string;
  icon: LucideIcon;
  tone: "sage" | "pink" | "warm";
}[] = [
  { value: "easy", label: "Easy", bloom: "Remember · Understand", icon: Sprout, tone: "sage" },
  { value: "medium", label: "Medium", bloom: "Apply · Analyze", icon: Leaf, tone: "sage" },
  { value: "hard", label: "Hard", bloom: "Evaluate · Create", icon: TreeDeciduous, tone: "warm" },
  { value: "mixed", label: "Mixed", bloom: "A bit of everything", icon: Flower2, tone: "pink" },
];

interface OptionsFormProps {
  value: QuizSettings;
  onChange: (value: QuizSettings) => void;
}

export function OptionsForm({ value, onChange }: OptionsFormProps) {
  const countId = useId();
  const focusId = useId();
  const set = (patch: Partial<QuizSettings>) => onChange({ ...value, ...patch });

  const toggleType = (t: QuestionType) =>
    set({
      types: value.types.includes(t) ? value.types.filter((x) => x !== t) : [...value.types, t],
    });

  const setCount = (n: number) =>
    set({ countPerType: Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n) || COUNT_MIN)) });

  return (
    <div className="grid gap-7">
      <fieldset className="grid gap-2">
        <legend className="text-text mb-2 text-sm font-medium">Question types</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {TYPES.map((t) => {
            const on = value.types.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleType(t.value)}
                className={cn(
                  "border-border bg-surface relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:bg-pink-50",
                  on && "shadow-soft border-pink-400 bg-pink-50",
                )}
              >
                <IconChip icon={t.icon} tone={on ? "pink" : "sage"} />
                <span className="min-w-0">
                  <span className="text-text block text-sm font-medium">{t.label}</span>
                  <span className="text-muted-text block text-xs">{t.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "border-border ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                    on && "border-sage-700 bg-sage-700 text-on-primary",
                  )}
                >
                  {on && <Check strokeWidth={2.5} className="size-3" />}
                </span>
              </button>
            );
          })}
        </div>
        {value.types.length === 0 && (
          <p className="text-danger-text text-xs">Pick at least one question type.</p>
        )}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="grid gap-2">
          <Label htmlFor={countId}>Questions per type</Label>
          <div className="border-border bg-surface flex items-center gap-1 rounded-full border p-1">
            <button
              type="button"
              aria-label="Fewer questions"
              onClick={() => setCount(value.countPerType - 1)}
              disabled={value.countPerType <= COUNT_MIN}
              className="flex size-8 items-center justify-center rounded-full hover:bg-pink-50 disabled:opacity-40"
            >
              <Minus aria-hidden strokeWidth={1.5} className="size-4" />
            </button>
            <Input
              id={countId}
              type="number"
              inputMode="numeric"
              min={COUNT_MIN}
              max={COUNT_MAX}
              value={value.countPerType}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-8 w-12 [appearance:textfield] border-0 bg-transparent px-0 text-center font-medium tabular-nums focus-visible:outline-0 [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="More questions"
              onClick={() => setCount(value.countPerType + 1)}
              disabled={value.countPerType >= COUNT_MAX}
              className="flex size-8 items-center justify-center rounded-full hover:bg-pink-50 disabled:opacity-40"
            >
              <Plus aria-hidden strokeWidth={1.5} className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={focusId}>
            Focus topic <span className="text-muted-text font-normal">(optional)</span>
          </Label>
          <Input
            id={focusId}
            value={value.focus ?? ""}
            maxLength={200}
            onChange={(e) => set({ focus: e.target.value })}
            placeholder="e.g. only Chapter 3: Deadlocks"
            className="rounded-full px-4"
          />
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-text mb-2 text-sm font-medium">Difficulty</legend>
        <RadioGroup
          value={value.difficulty}
          onValueChange={(v) => set({ difficulty: v as DifficultySetting })}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          aria-label="Difficulty"
        >
          {DIFFICULTIES.map((d) => (
            <RadioCard
              key={d.value}
              value={d.value}
              className="data-[state=checked]:shadow-soft items-center gap-1.5 rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-px"
            >
              <IconChip icon={d.icon} tone={d.tone} size="lg" className="mb-1" />
              <span className="text-text text-sm font-medium">{d.label}</span>
              <span className="text-muted-text text-xs">{d.bloom}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  );
}
