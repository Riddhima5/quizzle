import pLimit from "p-limit";
import { callTool, type UsageSink } from "./anthropic";
import { countIllegible, joinPages } from "./pages";
import type { ImageTranscription } from "./types";
import {
  buildTranscribeImagePrompt,
  EFFORT,
  TEMPERATURE,
  TOOL,
  TranscriptionOutputSchema,
  type ImageInput,
} from "@/prompts/transcribeImage";

export const TRANSCRIBE_CONCURRENCY = 4;

/** Transcribe one image per call, at most 4 in flight, then join in the given order. */
export async function transcribeImages(
  images: readonly ImageInput[],
  onUsage?: UsageSink,
): Promise<{ pages: ImageTranscription[]; combined: string }> {
  const limit = pLimit(TRANSCRIBE_CONCURRENCY);
  const pages = await Promise.all(
    images.map((image, order) =>
      limit(async (): Promise<ImageTranscription> => {
        const prompt = buildTranscribeImagePrompt(image);
        const { data } = await callTool({
          stage: "transcribe",
          ...prompt,
          tool: TOOL,
          schema: TranscriptionOutputSchema,
          effort: EFFORT,
          temperature: TEMPERATURE,
          maxTokens: 8000,
          onUsage,
        });
        const transcription = data.transcription.trim();
        return {
          order,
          transcription,
          contentType: data.content_type,
          legibility: data.legibility,
          hasDiagrams: data.has_diagrams,
          illegibleCount: countIllegible(transcription),
        };
      }),
    ),
  );
  return { pages, combined: joinPages(pages.map((p) => p.transcription)) };
}
