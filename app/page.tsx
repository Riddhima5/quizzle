import { BadgeCheck, Feather, FileText, Flower2, Layers, Sparkles, Sprout } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { QuizCreator } from "@/components/upload/quiz-creator";

const FEATURES = [
  {
    icon: FileText,
    tone: "pink" as const,
    title: "Paste, upload or snap",
    body: "Typed notes, PDFs, or photos of handwriting and whiteboards.",
  },
  {
    icon: Layers,
    tone: "sage" as const,
    title: "Bloom-aligned questions",
    body: "MCQs, short answers and flashcards from recall to evaluation.",
  },
  {
    icon: BadgeCheck,
    tone: "pink" as const,
    title: "Independently verified",
    body: "A second pass re-answers every question from your notes alone.",
  },
];

/** Faint line-art accents scattered around the hero (decorative only). */
const ACCENTS = [
  { icon: Sprout, className: "left-[8%] top-[22%] -rotate-12 text-sage-500" },
  { icon: Flower2, className: "right-[9%] top-[18%] rotate-12 text-pink-400" },
  { icon: Feather, className: "left-[14%] bottom-[14%] rotate-[24deg] text-pink-400" },
  { icon: Sparkles, className: "right-[15%] bottom-[18%] text-sage-500" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="border-border bg-surface/60 shadow-soft relative mt-6 overflow-hidden rounded-3xl border px-6 pt-16 pb-14 text-center sm:px-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="paper-dots absolute inset-0 [mask-image:radial-gradient(70%_70%_at_50%_40%,black,transparent)]" />
          <div className="blob -top-16 -left-10 size-64 bg-pink-200" />
          <div className="blob bg-sage-200 -right-12 -bottom-20 size-72 [animation-delay:-6s]" />
          {ACCENTS.map(({ icon: Icon, className }, i) => (
            <Icon
              key={i}
              strokeWidth={1.1}
              className={`absolute hidden size-7 opacity-50 sm:block ${className}`}
            />
          ))}
        </div>

        <div className="relative">
          <p className="bg-surface/80 mb-5 inline-flex items-center gap-1.5 rounded-full border border-pink-200 px-3.5 py-1 text-xs text-pink-700">
            <Sparkles aria-hidden strokeWidth={1.5} className="size-3.5" />
            Lecture notes → practice quiz
          </p>
          <h1 className="text-text mx-auto max-w-2xl font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            Turn your notes into quizzes —{" "}
            <span className="text-sage-700 relative whitespace-nowrap italic">
              verified.
              <svg
                aria-hidden
                viewBox="0 0 120 12"
                className="absolute -bottom-2 left-0 h-3 w-full text-pink-400"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8 C 30 2, 60 12, 118 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="text-muted-text mx-auto mt-5 max-w-[56ch]">
            Quizzle writes questions grounded in your own material, then checks each answer against
            the source before you ever see it.
          </p>
        </div>
      </section>

      <section aria-label="Create a quiz">
        <QuizCreator />
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Features">
        {FEATURES.map(({ icon, tone, title, body }) => (
          <Card
            key={title}
            className="p-5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <IconChip icon={icon} tone={tone} className="mb-3" />
            <h2 className="text-text font-medium">{title}</h2>
            <p className="text-muted-text mt-1 text-sm">{body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
