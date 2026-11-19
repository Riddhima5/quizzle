"use client";

import type { ExtractImagesResponse } from "@/app/api/extract-images/route";
import type { ExtractPdfResponse } from "@/app/api/extract-pdf/route";
import type { ApiErrorBody } from "@/lib/http";
import type { Quiz, QuizSettings } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    typeof (v as { error: unknown }).error === "object"
  );
}

async function handle<T>(res: Response): Promise<T> {
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (isApiErrorBody(body)) throw new ApiError(body.error.message, res.status, body.error.code);
    throw new ApiError(`Request failed (${res.status}).`, res.status, "http_error");
  }
  return body as T;
}

export async function generateQuiz(notes: string, settings: QuizSettings): Promise<Quiz> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, settings }),
      signal: AbortSignal.timeout(300_000), // matches the route's maxDuration
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(
        "This took too long — the free AI service is probably busy. Try again in a few minutes, or ask for fewer questions.",
        408,
        "timeout",
      );
    }
    throw error;
  }
  return handle(res);
}

export async function extractPdf(file: File): Promise<ExtractPdfResponse> {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch("/api/extract-pdf", { method: "POST", body: form }));
}

export async function extractImages(images: readonly Blob[]): Promise<ExtractImagesResponse> {
  const form = new FormData();
  images.forEach((blob, i) => form.append("images", blob, `page-${i + 1}.jpg`));
  return handle(await fetch("/api/extract-images", { method: "POST", body: form }));
}
