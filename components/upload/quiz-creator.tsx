"use client";

import { useEffect, useState } from "react";
import { Camera, ClipboardPaste, FileText, Leaf, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { StepBadge } from "@/components/ui/icon-chip";
import { toast } from "sonner";
import { QuizView } from "@/components/quiz/quiz-view";
import { Button } from "@/components/ui/button";
import { generateQuiz } from "@/lib/client/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COUNT_DEFAULT } from "@/lib/constants";
import { NotesSchema, QuizSettingsSchema } from "@/lib/schemas";
import type { Quiz, QuizSettings } from "@/lib/types";
import { NotesEditor } from "./notes-editor";
import { OptionsForm } from "./options-form";
import { PdfPanel } from "./pdf-panel";
import { PhotosPanel } from "./photos-panel";
import { combinePhotos, usePhotos, type PhotoItem } from "./use-photos";

type Source = "paste" | "pdf" | "photos";

const DEFAULT_SETTINGS: QuizSettings = {
  types: ["mcq", "short", "flashcard"],
  countPerType: COUNT_DEFAULT,
  difficulty: "mixed",
  focus: "",
};

/** Live elapsed time while generating, so a slow free-tier response doesn't look frozen. */
function GeneratingStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <span role="status" className="text-muted-text inline-flex items-center gap-2 text-sm">
      <Leaf aria-hidden strokeWidth={1.5} className="breathe text-sage-500 size-4 shrink-0" />
      <span>
        {seconds < 45
          ? seconds < 8
            ? "Reading your notes…"
            : "Writing questions, then checking each answer…"
          : "Taking a little longer than usual — still working…"}{" "}
        <span className="tabular-nums">{clock}</span>
      </span>
    </span>
  );
}

export function QuizCreator() {
  const [tab, setTab] = useState<Source>("paste");
  const [notes, setNotes] = useState("");
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
  const photos = usePhotos();
  /** Last notes text produced automatically from photos — lets us rebuild it if untouched. */
  const [autoNotes, setAutoNotes] = useState<string | null>(null);
  const [photosStale, setPhotosStale] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  function replaceNotes(text: string, from: string) {
    if (notes.trim() && notes !== text) toast.info(`Notes replaced with the ${from} text.`);
    setNotes(text);
  }

  async function transcribe(list: readonly PhotoItem[] = photos.photos) {
    const combined = await photos.transcribe(list);
    if (combined === null) return;
    replaceNotes(combined, "photo");
    setAutoNotes(combined);
    setPhotosStale(false);
  }

  function onArranged(next: PhotoItem[]) {
    if (!next.some((p) => p.result)) return;
    const combined = combinePhotos(next);
    if (autoNotes !== null && notes === autoNotes) {
      setNotes(combined);
      setAutoNotes(combined);
    } else {
      setPhotosStale(true);
    }
  }

  function rebuildFromPhotos() {
    const combined = combinePhotos(photos.photos);
    setNotes(combined);
    setAutoNotes(combined);
    setPhotosStale(false);
  }

  function onPdfPagesAsPhotos(images: Blob[], name: string) {
    const items = photos.addPrepared(images, name);
    setTab("photos");
    toast.info(`Reading ${items.length} page${items.length === 1 ? "" : "s"} as photos…`);
    void transcribe(items);
  }

  async function onGenerate() {
    const n = NotesSchema.safeParse(notes);
    if (!n.success) return toast.error(n.error.issues[0]?.message ?? "Check your notes.");
    const s = QuizSettingsSchema.safeParse(settings);
    if (!s.success) return toast.error(s.error.issues[0]?.message ?? "Check your settings.");
    setGenerating(true);
    try {
      const result = await generateQuiz(n.data, s.data);
      setQuiz(result);
      setTimeout(
        () => document.getElementById("quiz-top")?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't generate the quiz.");
    } finally {
      setGenerating(false);
    }
  }

  const showEditor = tab === "paste" || notes.length > 0;

  return (
    <>
      {quiz && <QuizView key={quiz.id} quiz={quiz} onBack={() => setQuiz(null)} />}
      {/* Kept mounted while a quiz is shown so notes and photos survive "Back to my notes". */}
      <div className={quiz ? "hidden" : "grid gap-6"}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <StepBadge n={1} /> Add your notes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Source)}>
              <TabsList aria-label="Notes source">
                <TabsTrigger value="paste">
                  <ClipboardPaste aria-hidden strokeWidth={1.5} /> Paste
                </TabsTrigger>
                <TabsTrigger value="pdf">
                  <FileText aria-hidden strokeWidth={1.5} /> PDF
                </TabsTrigger>
                <TabsTrigger value="photos">
                  <Camera aria-hidden strokeWidth={1.5} /> Photos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paste" />
              <TabsContent value="pdf">
                <PdfPanel
                  onText={(t) => replaceNotes(t, "PDF")}
                  onPagesAsPhotos={onPdfPagesAsPhotos}
                />
              </TabsContent>
              <TabsContent value="photos" forceMount className="data-[state=inactive]:hidden">
                <PhotosPanel
                  controller={photos}
                  onTranscribe={() => void transcribe()}
                  onArranged={onArranged}
                />
              </TabsContent>
            </Tabs>

            {photosStale && tab === "photos" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-pink-50 px-4 py-2 text-sm">
                <span className="text-pink-700">
                  Your photos changed, but the text below still uses the old order.
                </span>
                <Button variant="ghost" size="sm" onClick={rebuildFromPhotos}>
                  <RefreshCw aria-hidden strokeWidth={1.5} /> Update text (discards edits)
                </Button>
              </div>
            )}

            {showEditor && (
              <NotesEditor
                value={notes}
                onChange={setNotes}
                label={
                  tab === "paste"
                    ? "Lecture notes"
                    : "Extracted text — check and edit before generating"
                }
                placeholder="Paste your lecture notes here…"
                hint={
                  tab === "paste"
                    ? undefined
                    : "Fix anything that was misread. Highlighted [illegible] spots couldn't be read."
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <StepBadge n={2} /> Choose your quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <OptionsForm value={settings} onChange={setSettings} />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {generating && <GeneratingStatus />}
              <Button size="lg" onClick={() => void onGenerate()} disabled={generating}>
                {generating ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <Sparkles aria-hidden strokeWidth={1.5} />
                )}
                {generating ? "Generating…" : "Generate quiz"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
