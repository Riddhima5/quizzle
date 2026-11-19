import { NextResponse } from "next/server";
import { MAX_CLAUDE_IMAGE_BYTES, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/constants";
import { sniffImageType } from "@/lib/file-sniff";
import { errorResponse, jsonError, rateLimited } from "@/lib/http";
import { transcriptionLimiter } from "@/lib/rate-limit";
import { transcribeImages } from "@/lib/transcribe";
import type { ImageTranscription } from "@/lib/types";
import { PROMPT_VERSION } from "@/prompts/transcribeImage";
import type { ImageInput } from "@/prompts/transcribeImage";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface ExtractImagesResponse {
  pages: ImageTranscription[];
  combined: string;
  promptVersion: string;
}

/**
 * Multipart body: one or more `images` fields, in the user's chosen order.
 * MIME type and size are validated here too (never trust the client), using magic bytes.
 */
export async function POST(req: Request) {
  const limited = rateLimited(req, transcriptionLimiter);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid_form", "Expected multipart/form-data with 'images' fields.");
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError(400, "missing_images", "No images were uploaded.");
  if (files.length > MAX_IMAGES) {
    return jsonError(400, "too_many_images", `Upload at most ${MAX_IMAGES} images per quiz.`);
  }

  const images: ImageInput[] = [];
  for (const [i, file] of files.entries()) {
    const label = `Photo ${i + 1}`;
    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError(413, "image_too_large", `${label} is larger than 10 MB.`);
    }
    if (file.size > MAX_CLAUDE_IMAGE_BYTES) {
      return jsonError(413, "image_too_large", `${label} is still over 5 MB after compression.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) {
      return jsonError(415, "unsupported_image", `${label} must be a JPG, PNG or WEBP image.`);
    }
    images.push({ mediaType, base64: Buffer.from(bytes).toString("base64") });
  }

  try {
    const result = await transcribeImages(images);
    return NextResponse.json<ExtractImagesResponse>({ ...result, promptVersion: PROMPT_VERSION });
  } catch (error) {
    return errorResponse(error);
  }
}
