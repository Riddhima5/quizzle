import { extractText, getDocumentProxy } from "unpdf";
import { looksScanned } from "./pages";

export interface PdfExtraction {
  text: string;
  pageCount: number;
  scanned: boolean;
}

/** Light clean-up of PDF text: de-hyphenate line breaks, collapse runs of blank lines. */
export function cleanPdfText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = text.map(cleanPdfText);
  return {
    text: pages.filter(Boolean).join("\n\n"),
    pageCount: totalPages,
    scanned: looksScanned(pages),
  };
}
