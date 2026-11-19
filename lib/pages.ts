import { ILLEGIBLE_TOKEN } from "./constants";

/** Join per-page transcriptions in the user's order with `--- Page N ---` separators. */
export function joinPages(pages: readonly string[]): string {
  return pages
    .map((text, i) => ({ text: text.trim(), n: i + 1 }))
    .filter((p) => p.text.length > 0)
    .map((p) => `--- Page ${p.n} ---\n${p.text}`)
    .join("\n\n");
}

export function countIllegible(text: string): number {
  let count = 0;
  let idx = text.indexOf(ILLEGIBLE_TOKEN);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(ILLEGIBLE_TOKEN, idx + ILLEGIBLE_TOKEN.length);
  }
  return count;
}

/** Split text into alternating plain / [illegible] segments for highlighting. */
export function splitIllegible(text: string): { text: string; illegible: boolean }[] {
  const parts = text.split(ILLEGIBLE_TOKEN);
  const out: { text: string; illegible: boolean }[] = [];
  parts.forEach((part, i) => {
    if (part) out.push({ text: part, illegible: false });
    if (i < parts.length - 1) out.push({ text: ILLEGIBLE_TOKEN, illegible: true });
  });
  return out;
}

/**
 * Heuristic for scanned PDFs: if the average page yields almost no selectable text,
 * the PDF is probably images of pages.
 */
export function looksScanned(pageTexts: readonly string[]): boolean {
  if (pageTexts.length === 0) return true;
  const total = pageTexts.reduce((n, t) => n + t.replace(/\s+/g, "").length, 0);
  return total / pageTexts.length < 30;
}
