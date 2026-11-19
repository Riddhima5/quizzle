"use client";

import { useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Camera, ImagePlus, Loader2, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_IMAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PhotoThumb } from "./photo-thumb";
import type { PhotoItem, PhotosController } from "./use-photos";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

interface PhotosPanelProps {
  controller: PhotosController;
  onTranscribe: () => void;
  /** Called with the new list after a reorder or removal. */
  onArranged: (photos: PhotoItem[]) => void;
}

export function PhotosPanel({ controller, onTranscribe, onArranged }: PhotosPanelProps) {
  const { photos, transcribing, addFiles, remove, rotate, reorder } = controller;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const preparing = photos.some((p) => p.status === "preparing");
  const pending = photos.filter((p) => p.status === "ready" && !p.result).length;
  const full = photos.length >= MAX_IMAGES;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onArranged(reorder(String(active.id), String(over.id)));
    }
  }

  function pick(files: FileList | null) {
    if (files?.length) addFiles(Array.from(files), photos.length);
  }

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }
      }}
    >
      <div
        className={cn(
          "border-border bg-sage-50/60 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors duration-150",
          dragging && "border-sage-500 bg-sage-50",
        )}
      >
        <p className="text-text max-w-[52ch] text-sm">
          Handwritten notes, whiteboards, textbook pages or slides — add up to {MAX_IMAGES} photos
          in reading order.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="hidden pointer-coarse:inline-flex"
            onClick={() => cameraRef.current?.click()}
            disabled={full || transcribing}
          >
            <Camera aria-hidden strokeWidth={1.5} />
            Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => galleryRef.current?.click()}
            disabled={full || transcribing}
          >
            <ImagePlus aria-hidden strokeWidth={1.5} />
            <span className="pointer-coarse:hidden">Choose photos</span>
            <span className="hidden pointer-coarse:inline">Choose from gallery</span>
          </Button>
        </div>
        <p className="text-muted-text text-xs">
          JPG, PNG, WEBP or HEIC · up to 10 MB each · resized in your browser before upload
        </p>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length > 0 && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ol
                aria-label="Photos in page order"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
              >
                {photos.map((photo, i) => (
                  <PhotoThumb
                    key={photo.id}
                    photo={photo}
                    index={i}
                    disabled={transcribing}
                    onRemove={() => onArranged(remove(photo.id))}
                    onRotate={() => void rotate(photo)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-text text-xs">
              {photos.length}/{MAX_IMAGES} photos · drag to reorder — page order matters.
            </p>
            <Button
              type="button"
              onClick={onTranscribe}
              disabled={transcribing || preparing || pending === 0}
            >
              {transcribing ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <ScanText aria-hidden strokeWidth={1.5} />
              )}
              {transcribing
                ? `Reading ${pending} photo${pending === 1 ? "" : "s"}…`
                : preparing
                  ? "Preparing photos…"
                  : pending === 0
                    ? "All photos read"
                    : `Read my notes (${pending})`}
            </Button>
          </div>

          {transcribing && (
            <div aria-hidden className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
