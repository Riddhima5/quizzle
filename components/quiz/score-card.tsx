"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function message(ratio: number): { title: string; body: string } {
  if (ratio === 1)
    return { title: "Perfect — beautifully done.", body: "You know this material well." };
  if (ratio >= 0.8) return { title: "Lovely work.", body: "Just a detail or two to revisit." };
  if (ratio >= 0.5)
    return {
      title: "Good progress.",
      body: "Read the explanations below for the ones you missed.",
    };
  return {
    title: "A gentle start.",
    body: "Review the explanations, then try again — it sticks better the second time.",
  };
}

const CONFETTI = [
  "bg-pink-400",
  "bg-sage-500",
  "bg-pink-200",
  "bg-sage-200",
  "bg-warning",
  "bg-pink-400",
  "bg-sage-500",
  "bg-pink-200",
  "bg-sage-200",
  "bg-pink-400",
  "bg-sage-500",
  "bg-warning",
];

/** Soft ring + encouraging message. A small palette confetti falls once on a perfect score. */
export function ScoreCard({
  score,
  total,
  onRetry,
}: {
  score: number;
  total: number;
  onRetry: () => void;
}) {
  const ratio = total ? score / total : 0;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const { title, body } = message(ratio);

  return (
    <div
      role="status"
      className="fade-up border-border bg-sage-50 relative flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl border px-6 py-5"
    >
      {ratio === 1 && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {CONFETTI.map((color, i) => (
            <span
              key={i}
              className={`confetti-piece ${color}`}
              style={{ left: `${6 + i * 8}%`, animationDelay: `${(i % 4) * 120}ms` }}
            />
          ))}
        </div>
      )}
      <svg viewBox="0 0 72 72" className="size-20 shrink-0 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--sage-200)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={ratio >= 0.5 ? "var(--sage-500)" : "var(--pink-400)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
        <text
          x="36"
          y="36"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-[var(--text)] font-serif text-[15px]"
          style={{ transformOrigin: "36px 36px" }}
        >
          {score}/{total}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-text font-serif text-xl">{title}</p>
        <p className="text-muted-text text-sm">{body}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw aria-hidden strokeWidth={1.5} /> Try again
      </Button>
    </div>
  );
}
