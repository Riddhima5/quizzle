"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, CheckCircle2, ImageOff, Loader2, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhotoItem } from "./use-photos";

interface PhotoThumbProps {
  photo: PhotoItem;
  index: number;
  disabled: boolean;
  onRemove: () => void;
  onRotate: () => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function PhotoThumb({ photo, index, disabled, onRemove, onRotate }: PhotoThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled,
  });

  const r = photo.result;
  const noNotes = r && !r.transcription;
  const poor = r && r.transcription && r.legibility === "poor";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex flex-col gap-1.5", isDragging && "z-10 opacity-80")}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Photo ${index + 1}: ${photo.name}. Drag or use arrow keys after pressing space to reorder.`}
        className={cn(
          "group border-border shadow-soft relative aspect-[3/4] touch-none overflow-hidden rounded-xl border bg-pink-50",
          !disabled && "cursor-grab active:cursor-grabbing",
          isDragging && "shadow-lift",
        )}
      >
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: URLs can't use next/image
          <img src={photo.url} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center">
            {photo.status === "error" ? (
              <ImageOff aria-hidden strokeWidth={1.25} className="text-danger size-6" />
            ) : (
              <Loader2
                aria-hidden
                strokeWidth={1.5}
                className="size-6 animate-spin text-pink-600"
              />
            )}
          </div>
        )}

        <span className="bg-surface/90 text-text absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {index + 1}
        </span>

        <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            onPointerDown={stop}
            onKeyDown={stop}
            onClick={onRotate}
            disabled={disabled || !photo.blob}
            aria-label={`Rotate photo ${index + 1}`}
            className="bg-surface/90 text-text hover:bg-surface rounded-full p-1.5 disabled:opacity-40"
          >
            <RotateCw aria-hidden strokeWidth={1.5} className="size-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={stop}
            onKeyDown={stop}
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove photo ${index + 1}`}
            className="bg-surface/90 text-text hover:bg-danger-bg hover:text-danger-text rounded-full p-1.5 disabled:opacity-40"
          >
            <X aria-hidden strokeWidth={1.5} className="size-3.5" />
          </button>
        </div>

        {r && !noNotes && !poor && (
          <CheckCircle2
            aria-label="Transcribed"
            strokeWidth={1.5}
            className="bg-surface/90 text-sage-700 absolute right-2 bottom-2 size-5 rounded-full p-0.5"
          />
        )}
      </div>

      {photo.status === "error" && <p className="text-danger-text text-xs">{photo.error}</p>}
      {noNotes && <p className="text-muted-text text-xs">No notes found in this photo</p>}
      {poor && (
        <p className="text-warning-text flex gap-1 text-xs">
          <AlertTriangle aria-hidden strokeWidth={1.5} className="mt-0.5 size-3 shrink-0" />
          This photo is hard to read. Try a brighter, straight-on shot.
        </p>
      )}
    </li>
  );
}
