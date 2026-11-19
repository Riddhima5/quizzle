"use client";

import { useId, useMemo, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ILLEGIBLE_TOKEN, NOTES_MAX_CHARS, NOTES_MIN_CHARS } from "@/lib/constants";
import { countIllegible, splitIllegible } from "@/lib/pages";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  placeholder?: string;
}

/** Shared metrics so the highlight layer lines up exactly with the textarea text. */
const TEXT_METRICS = "px-4 py-3 text-sm leading-relaxed font-sans whitespace-pre-wrap break-words";

/**
 * Editable notes preview. `[illegible]` markers from photo transcription are highlighted in pink
 * using a mirror layer behind a transparent textarea (textareas can't style ranges themselves).
 */
export function NotesEditor({ value, onChange, label, hint, placeholder }: NotesEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const length = value.trim().length;
  const illegible = useMemo(() => countIllegible(value), [value]);
  const segments = useMemo(() => splitIllegible(value), [value]);

  const tooShort = length > 0 && length < NOTES_MIN_CHARS;
  const tooLong = length > NOTES_MAX_CHARS;

  function syncScroll() {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

  function jumpToNextIllegible() {
    const ta = textareaRef.current;
    if (!ta) return;
    const from = ta.selectionEnd;
    let idx = value.indexOf(ILLEGIBLE_TOKEN, from);
    if (idx === -1) idx = value.indexOf(ILLEGIBLE_TOKEN);
    if (idx === -1) return;
    ta.focus();
    ta.setSelectionRange(idx, idx + ILLEGIBLE_TOKEN.length);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-text text-sm font-medium">
          {label}
        </label>
        <span
          aria-live="polite"
          className={cn(
            "text-xs tabular-nums",
            tooLong ? "text-danger-text" : tooShort ? "text-warning-text" : "text-muted-text",
          )}
        >
          {length.toLocaleString()} / {NOTES_MAX_CHARS.toLocaleString()}
        </span>
      </div>
      {hint && <p className="text-muted-text -mt-1 text-xs">{hint}</p>}

      <div className="border-border bg-surface focus-within:shadow-soft relative rounded-2xl border transition-colors duration-150 focus-within:border-pink-400">
        <div
          ref={mirrorRef}
          aria-hidden
          className={cn(
            TEXT_METRICS,
            "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
          )}
        >
          {segments.map((s, i) =>
            s.illegible ? (
              <mark key={i} className="rounded-sm bg-pink-200 text-transparent">
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
          {"\n"}
        </div>
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          placeholder={placeholder}
          spellCheck
          aria-describedby={`${id}-status`}
          className={cn(
            TEXT_METRICS,
            "text-text placeholder:text-muted-text relative block h-80 w-full resize-y rounded-2xl bg-transparent focus:outline-none",
          )}
        />
      </div>

      <div
        id={`${id}-status`}
        className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs"
      >
        {tooShort ? (
          <span className="text-warning-text">
            Add a bit more — at least {NOTES_MIN_CHARS} characters are needed.
          </span>
        ) : tooLong ? (
          <span className="text-danger-text">
            That&apos;s over the {NOTES_MAX_CHARS.toLocaleString()}-character limit — trim it or
            split it into two quizzes.
          </span>
        ) : (
          <span />
        )}
        {illegible > 0 && (
          <span className="inline-flex items-center gap-2 text-pink-700">
            <AlertTriangle aria-hidden strokeWidth={1.5} className="size-3.5" />
            {illegible} unreadable {illegible === 1 ? "spot" : "spots"} marked{" "}
            <code className="rounded bg-pink-50 px-1">[illegible]</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={jumpToNextIllegible}
            >
              Jump to next
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
