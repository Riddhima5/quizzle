"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { extractImages } from "@/lib/client/api";
import { isHeic, prepareImage, rotateImage } from "@/lib/client/image-prep";
import { ACCEPTED_IMAGE_INPUT, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/constants";
import { joinPages } from "@/lib/pages";
import type { ContentType, Legibility } from "@/lib/types";
import { newId } from "@/lib/utils";

export interface PhotoResult {
  transcription: string;
  legibility: Legibility;
  contentType: ContentType;
  illegibleCount: number;
  hasDiagrams: boolean;
}

export interface PhotoItem {
  id: string;
  name: string;
  status: "preparing" | "ready" | "error";
  blob?: Blob;
  url?: string;
  error?: string;
  /** Present once transcribed; cleared if the photo is rotated. */
  result?: PhotoResult;
}

/** Combined notes text for photos in display order (`--- Page N ---` separators). */
export function combinePhotos(photos: readonly PhotoItem[]): string {
  return joinPages(photos.map((p) => p.result?.transcription ?? ""));
}

function acceptable(file: File): string | null {
  if (!ACCEPTED_IMAGE_INPUT.includes(file.type) && !isHeic(file)) {
    return `${file.name}: use JPG, PNG, WEBP or HEIC.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over 10 MB.`;
  return null;
}

export function usePhotos() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [transcribing, setTranscribing] = useState(false);

  // Revoke object URLs on unmount.
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const dropUrl = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  };

  const patch = (id: string, update: Partial<PhotoItem>) =>
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...update } : p)));

  const addFiles = useCallback((files: readonly File[], currentCount: number) => {
    const room = MAX_IMAGES - currentCount;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_IMAGES} photos per quiz.`);
      return;
    }
    if (files.length > room)
      toast.warning(`Only the first ${room} photo(s) were added (max ${MAX_IMAGES}).`);

    const accepted: { item: PhotoItem; file: File }[] = [];
    for (const file of files.slice(0, room)) {
      const problem = acceptable(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      accepted.push({ item: { id: newId("ph"), name: file.name, status: "preparing" }, file });
    }
    if (accepted.length === 0) return;
    setPhotos((list) => [...list, ...accepted.map((a) => a.item)]);

    for (const { item, file } of accepted) {
      prepareImage(file)
        .then((blob) => patch(item.id, { status: "ready", blob, url: makeUrl(blob) }))
        .catch(() => patch(item.id, { status: "error", error: "Couldn't process this image." }));
    }
  }, []);

  /** Add already-prepared JPEGs (e.g. rendered PDF pages). Returns the new items. */
  const addPrepared = useCallback((blobs: readonly Blob[], baseName: string): PhotoItem[] => {
    const items: PhotoItem[] = blobs.slice(0, MAX_IMAGES).map((blob, i) => ({
      id: newId("ph"),
      name: `${baseName} · page ${i + 1}`,
      status: "ready",
      blob,
      url: makeUrl(blob),
    }));
    setPhotos(items); // a rendered PDF replaces the current photo set
    return items;
  }, []);

  /** Returns the new list so callers can react to the new arrangement immediately. */
  const remove = (id: string): PhotoItem[] => {
    dropUrl(photos.find((p) => p.id === id)?.url);
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    return next;
  };

  const rotate = useCallback(async (photo: PhotoItem) => {
    if (!photo.blob) return;
    try {
      const blob = await rotateImage(photo.blob);
      dropUrl(photo.url);
      patch(photo.id, { blob, url: makeUrl(blob), result: undefined });
    } catch {
      toast.error("Couldn't rotate that photo.");
    }
  }, []);

  const reorder = (activeId: string, overId: string): PhotoItem[] => {
    const from = photos.findIndex((p) => p.id === activeId);
    const to = photos.findIndex((p) => p.id === overId);
    if (from < 0 || to < 0) return photos;
    const next = arrayMove(photos, from, to);
    setPhotos(next);
    return next;
  };

  /**
   * Transcribe every ready photo that doesn't have a result yet (so rotating or adding one
   * photo doesn't re-bill the others). Returns the combined text in display order, or null.
   */
  const transcribe = useCallback(async (list: readonly PhotoItem[]): Promise<string | null> => {
    const pending = list.filter((p) => p.status === "ready" && p.blob && !p.result);
    if (pending.length === 0) return combinePhotos(list);
    setTranscribing(true);
    try {
      const response = await extractImages(pending.map((p) => p.blob as Blob));
      const byId = new Map<string, PhotoResult>();
      response.pages.forEach((page) => {
        const photo = pending[page.order];
        if (photo) {
          byId.set(photo.id, {
            transcription: page.transcription,
            legibility: page.legibility,
            contentType: page.contentType,
            illegibleCount: page.illegibleCount,
            hasDiagrams: page.hasDiagrams,
          });
        }
      });
      setPhotos((current) =>
        current.map((p) => (byId.has(p.id) ? { ...p, result: byId.get(p.id) } : p)),
      );
      const merged = list.map((p) => (byId.has(p.id) ? { ...p, result: byId.get(p.id) } : p));
      const empty = merged.filter((p) => p.result && !p.result.transcription).length;
      if (empty === merged.length) {
        toast.error("We couldn't find any notes in these photos.");
        return null;
      }
      return combinePhotos(merged);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read the photos.");
      return null;
    } finally {
      setTranscribing(false);
    }
  }, []);

  return { photos, transcribing, addFiles, addPrepared, remove, rotate, reorder, transcribe };
}

export type PhotosController = ReturnType<typeof usePhotos>;
