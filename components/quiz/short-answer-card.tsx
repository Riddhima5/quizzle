"use client";

import { useId, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import type { ShortAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemBadges, SourceQuote } from "./item-meta";

export function ShortAnswerCard({ item, index }: { item: ShortAnswer; index: number }) {
  const id = useId();
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-muted-text text-xs tabular-nums">Short answer {index + 1}</span>
        <ItemBadges item={item} />
      </div>
      <label htmlFor={id} className="text-text max-w-[70ch] text-base leading-relaxed">
        {item.question}
      </label>
      <textarea
        id={id}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Type your answer…"
        className={cn(fieldClass, "resize-y py-2 leading-relaxed")}
      />
      {revealed ? (
        <div className="bg-sage-50 grid gap-3 rounded-lg p-4">
          <p className="text-text text-sm">
            <span className="text-sage-800 font-medium">Model answer: </span>
            {item.referenceAnswer}
          </p>
          <div>
            <p className="text-muted-text mb-1 text-xs font-medium">A full answer mentions:</p>
            <ul className="text-text marker:text-sage-500 list-disc space-y-0.5 pl-5 text-sm">
              {item.keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
          <SourceQuote quote={item.sourceQuote} />
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            <Eye aria-hidden strokeWidth={1.5} /> Reveal answer
          </Button>
        </div>
      )}
    </Card>
  );
}
