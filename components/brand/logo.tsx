import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wordmark: serif "Quizzle" in sage-700; the dot of the "i" is a pink-400 accent. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Quizzle home"
      className={cn("group inline-flex items-center gap-1.5 rounded-lg", className)}
    >
      <Leaf
        aria-hidden
        strokeWidth={1.25}
        className="text-sage-500 size-5 transition-transform duration-200 group-hover:-rotate-12"
      />
      <span className="text-sage-700 font-serif text-2xl font-medium tracking-tight">
        Qu
        <span className="relative inline-block">
          ı
          <span
            aria-hidden
            className="absolute top-[0.18em] left-1/2 size-[0.2em] -translate-x-1/2 rounded-full bg-pink-400"
          />
        </span>
        zzle
      </span>
    </Link>
  );
}
