"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MCQ } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemBadges, SourceQuote } from "./item-meta";
import { ScoreCard } from "./score-card";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function McqSection({ items }: { items: MCQ[] }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answered = Object.keys(picked).length;
  const score = items.filter((q) => q.options[picked[q.id] ?? -1]?.isCorrect).length;

  function reset() {
    setPicked({});
    setSubmitted(false);
  }

  return (
    <div className="grid gap-4">
      {submitted && <ScoreCard score={score} total={items.length} onRetry={reset} />}

      {items.map((q, qi) => {
        const choice = picked[q.id];
        return (
          <Card key={q.id} className="grid gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-muted-text text-xs tabular-nums">Question {qi + 1}</span>
              <ItemBadges item={q} />
            </div>
            <fieldset className="grid gap-3">
              <legend className="text-text mb-3 max-w-[70ch] text-base leading-relaxed">
                {q.question}
              </legend>
              {q.options.map((opt, oi) => {
                const selected = choice === oi;
                const showCorrect = submitted && opt.isCorrect;
                const showWrong = submitted && selected && !opt.isCorrect;
                return (
                  <label
                    key={oi}
                    className={cn(
                      "border-border bg-surface flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-200",
                      !submitted && "hover:bg-pink-50",
                      !submitted && selected && "border-pink-400 bg-pink-50",
                      showCorrect && "border-sage-500 bg-success-bg",
                      showWrong && "border-danger bg-danger-bg",
                      submitted && "cursor-default",
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="sr-only"
                      checked={selected}
                      disabled={submitted}
                      onChange={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "border-border text-muted-text flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                        selected && !submitted && "border-pink-400 text-pink-700",
                        showCorrect && "border-sage-700 bg-sage-700 text-on-primary",
                        showWrong && "border-danger bg-danger text-on-primary",
                      )}
                    >
                      {showCorrect ? (
                        <Check className="size-3.5" />
                      ) : showWrong ? (
                        <X className="size-3.5" />
                      ) : (
                        LETTERS[oi]
                      )}
                    </span>
                    <span className="text-text pt-0.5">{opt.text}</span>
                  </label>
                );
              })}
            </fieldset>
            {submitted && (
              <div className="border-border grid gap-2 border-t pt-4">
                <p className="text-text text-sm">
                  <span
                    className={cn(
                      "font-medium",
                      q.options[choice ?? -1]?.isCorrect ? "text-success-text" : "text-danger-text",
                    )}
                  >
                    {choice === undefined
                      ? "Not answered. "
                      : q.options[choice]?.isCorrect
                        ? "Correct. "
                        : "Not quite. "}
                  </span>
                  {q.explanation}
                </p>
                <SourceQuote quote={q.sourceQuote} />
              </div>
            )}
          </Card>
        );
      })}

      {!submitted && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-muted-text text-xs">
            {answered} of {items.length} answered
          </span>
          <Button size="lg" onClick={() => setSubmitted(true)} disabled={answered === 0}>
            Submit answers
          </Button>
        </div>
      )}
    </div>
  );
}
