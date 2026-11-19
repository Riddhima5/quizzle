import { NextResponse } from "next/server";
import { MAX_PDF_BYTES } from "@/lib/constants";
import { isPdf } from "@/lib/file-sniff";
import { jsonError } from "@/lib/http";
import { extractPdfText } from "@/lib/pdf";

export const runtime = "nodejs";

export interface ExtractPdfResponse {
  text: string;
  pageCount: number;
  scanned: boolean;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid_form", "Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "missing_file", "No PDF was uploaded.");
  if (file.size === 0) return jsonError(400, "empty_file", "That PDF is empty.");
  if (file.size > MAX_PDF_BYTES)
    return jsonError(413, "too_large", "PDFs must be 10 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return jsonError(415, "not_pdf", "That file doesn't look like a PDF.");

  try {
    const result = await extractPdfText(bytes);
    return NextResponse.json<ExtractPdfResponse>(result);
  } catch (error) {
    console.error("[extract-pdf]", error);
    return jsonError(
      422,
      "pdf_unreadable",
      "We couldn't read that PDF. It may be encrypted or damaged.",
    );
  }
}
