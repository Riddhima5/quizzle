import { BadgeCheck, CircleHelp, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QuizItem } from "@/lib/types";

const DIFFICULTY_VARIANT = { easy: "sage", medium: "pink", hard: "warning" } as const;

export function ItemBadges({ item }: { item: QuizItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={DIFFICULTY_VARIANT[item.difficulty]} className="capitalize">
        {item.difficulty}
      </Badge>
      {"bloom" in item && (
        <Badge variant="neutral" className="capitalize">
          {item.bloom}
        </Badge>
      )}
      {item.verification.status === "verified" ? (
        <Badge
          variant="success"
          title="An independent second pass reached the same answer from your notes."
        >
          <BadgeCheck aria-hidden strokeWidth={1.75} /> Verified
        </Badge>
      ) : (
        <Badge
          variant="warning"
          title="The verifier couldn't run, so this item wasn't double-checked."
        >
          <CircleHelp aria-hidden strokeWidth={1.75} /> Not verified
        </Badge>
      )}
    </div>
  );
}

export function SourceQuote({ quote }: { quote: string }) {
  return (
    <details className="group text-sm">
      <summary className="text-muted-text hover:text-text inline-flex cursor-pointer items-center gap-1.5 rounded text-xs">
        <Quote aria-hidden strokeWidth={1.5} className="size-3.5" /> Source
      </summary>
      <blockquote className="text-muted-text mt-2 border-l-2 border-pink-200 pl-3 italic">
        {quote}
      </blockquote>
    </details>
  );
}
