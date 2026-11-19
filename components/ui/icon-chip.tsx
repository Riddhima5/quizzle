import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  pink: "bg-pink-50 text-pink-700 ring-pink-200/70",
  sage: "bg-sage-50 text-sage-700 ring-sage-200/70",
  warm: "bg-warning-bg text-warning-text ring-warning/30",
} as const;

/** A soft pastel circle holding a thin-stroke icon. */
export function IconChip({
  icon: Icon,
  tone = "sage",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = {
    sm: "size-7 [&_svg]:size-3.5",
    md: "size-9 [&_svg]:size-4",
    lg: "size-11 [&_svg]:size-5",
  }[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1",
        TONES[tone],
        dims,
        className,
      )}
    >
      <Icon strokeWidth={1.5} />
    </span>
  );
}

/** Numbered step badge used in section titles ("1", "2"). */
export function StepBadge({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-pink-200 font-serif text-base text-pink-700"
    >
      {n}
    </span>
  );
}
