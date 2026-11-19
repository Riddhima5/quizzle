import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseJsonBody } from "@/lib/http";
import { generateQuiz } from "@/lib/pipeline";
import { NotesSchema, QuizSettingsSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({ notes: NotesSchema, settings: QuizSettingsSchema });

export async function POST(req: Request) {
  const body = await parseJsonBody(req, BodySchema);
  if (!body.ok) return body.response;
  try {
    const quiz = await generateQuiz(body.data.notes, body.data.settings);
    return NextResponse.json(quiz);
  } catch (error) {
    return errorResponse(error);
  }
}
