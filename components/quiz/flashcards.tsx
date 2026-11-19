"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Flower2, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemBadges, SourceQuote } from "./item-meta";

export function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  if (!card) return null;

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };

  return (
    <div
      className="grid gap-4"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-text text-xs tabular-nums">
          Card {index + 1} of {cards.length}
        </span>
        <ItemBadges item={card} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={
          flipped
            ? `Answer: ${card.back}. Click to show the front.`
            : `${card.front}. Click to flip.`
        }
        aria-live="polite"
        className="group h-64 w-full rounded-3xl perspective-[1200px] sm:h-72"
      >
        <div
          className={cn(
            "relative size-full transition-transform duration-500 ease-out transform-3d",
            flipped && "rotate-y-180",
          )}
        >
          <div className="border-border shadow-soft absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border bg-pink-200 p-8 backface-hidden">
            <div aria-hidden className="paper-dots absolute inset-0 opacity-60" />
            <span className="bg-surface/70 relative rounded-full px-3 py-0.5 text-[11px] tracking-wide text-pink-700 uppercase">
              Question
            </span>
            <p className="text-text relative max-w-[40ch] text-center font-serif text-2xl">
              {card.front}
            </p>
            <span className="relative text-xs text-pink-700">Click or press Space to flip</span>
            <Flower2
              aria-hidden
              strokeWidth={1.1}
              className="absolute right-5 bottom-5 size-6 text-pink-400 opacity-70"
            />
          </div>
          <div className="border-border bg-sage-200 shadow-soft absolute inset-0 flex rotate-y-180 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border p-8 backface-hidden">
            <div aria-hidden className="paper-dots absolute inset-0 opacity-60" />
            <span className="bg-surface/70 text-sage-800 relative rounded-full px-3 py-0.5 text-[11px] tracking-wide uppercase">
              Answer
            </span>
            <p className="text-text relative max-w-[50ch] text-center text-lg leading-relaxed">
              {card.back}
            </p>
            <Leaf
              aria-hidden
              strokeWidth={1.1}
              className="text-sage-700 absolute right-5 bottom-5 size-6 opacity-60"
            />
          </div>
        </div>
      </button>

      <div aria-hidden className="flex flex-wrap justify-center gap-1.5">
        {cards.map((c, i) => (
          <span
            key={c.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-pink-400" : "bg-border w-1.5",
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => go(-1)} aria-label="Previous card">
          <ChevronLeft aria-hidden strokeWidth={1.5} /> Previous
        </Button>
        {flipped ? <SourceQuote quote={card.sourceQuote} /> : <span />}
        <Button variant="outline" onClick={() => go(1)} aria-label="Next card">
          Next <ChevronRight aria-hidden strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
