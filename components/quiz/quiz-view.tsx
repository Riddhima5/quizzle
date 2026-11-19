"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Flashcard, MCQ, Quiz, ShortAnswer } from "@/lib/types";
import { Flashcards } from "./flashcards";
import { McqSection } from "./mcq-section";
import { ShortAnswerCard } from "./short-answer-card";

export function QuizView({ quiz, onBack }: { quiz: Quiz; onBack: () => void }) {
  const mcqs = quiz.items.filter((i): i is MCQ => i.type === "mcq");
  const shorts = quiz.items.filter((i): i is ShortAnswer => i.type === "short");
  const cards = quiz.items.filter((i): i is Flashcard => i.type === "flashcard");
  const hasQuiz = mcqs.length + shorts.length > 0;
  const { dropped, verified } = quiz.stats;

  return (
    <div id="quiz-top" className="fade-up mt-8 grid scroll-mt-24 gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft aria-hidden strokeWidth={1.5} /> Back to my notes
        </Button>
        <h2 className="text-text font-serif text-3xl font-medium tracking-tight">{quiz.title}</h2>
        <p className="text-muted-text flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden strokeWidth={1.5} className="text-sage-500 size-4" />
            {verified} of {quiz.items.length} items verified against your notes
          </span>
          {dropped > 0 && (
            <span className="bg-danger-bg text-danger-text rounded-full px-2.5 py-0.5 text-xs">
              {dropped} question{dropped === 1 ? "" : "s"} removed by verifier
            </span>
          )}
        </p>
      </div>

      {quiz.items.length === 0 ? (
        <p className="border-border bg-surface text-muted-text rounded-xl border p-8 text-center">
          The verifier removed every question — the notes may be too short or too ambiguous. Try
          adding more detail or a different focus topic.
        </p>
      ) : (
        <Tabs defaultValue={hasQuiz ? "quiz" : "cards"}>
          <TabsList aria-label="Quiz mode">
            {hasQuiz && (
              <TabsTrigger value="quiz">Quiz ({mcqs.length + shorts.length})</TabsTrigger>
            )}
            {cards.length > 0 && (
              <TabsTrigger value="cards">Flashcards ({cards.length})</TabsTrigger>
            )}
          </TabsList>
          {hasQuiz && (
            <TabsContent value="quiz" className="grid gap-8">
              {mcqs.length > 0 && <McqSection items={mcqs} />}
              {shorts.length > 0 && (
                <section className="grid gap-4" aria-label="Short answer questions">
                  {shorts.map((s, i) => (
                    <ShortAnswerCard key={s.id} item={s} index={i} />
                  ))}
                </section>
              )}
            </TabsContent>
          )}
          {cards.length > 0 && (
            <TabsContent value="cards">
              <Flashcards cards={cards} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
