import { describe, expect, it } from "vitest";
import { isPdf, sniffImageType } from "@/lib/file-sniff";
import { cleanPdfText } from "@/lib/pdf";
import { countIllegible, joinPages, looksScanned, splitIllegible } from "@/lib/pages";
import { RateLimiter } from "@/lib/rate-limit";
import { NotesSchema, QuizSettingsSchema } from "@/lib/schemas";

describe("joinPages", () => {
  it("adds page separators in the given order and keeps numbering for empty pages", () => {
    expect(joinPages(["alpha", "", "  gamma "])).toBe(
      "--- Page 1 ---\nalpha\n\n--- Page 3 ---\ngamma",
    );
  });
  it("returns empty string when nothing was transcribed", () => {
    expect(joinPages(["", "  "])).toBe("");
  });
});

describe("illegible markers", () => {
  const text = "The [illegible] lock and [illegible] semaphore";
  it("counts markers", () => {
    expect(countIllegible(text)).toBe(2);
    expect(countIllegible("clean")).toBe(0);
  });
  it("splits into highlight segments that rejoin to the original", () => {
    const segs = splitIllegible(text);
    expect(segs.filter((s) => s.illegible)).toHaveLength(2);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });
  it("handles a marker at the very start", () => {
    expect(splitIllegible("[illegible] x")[0]).toEqual({ text: "[illegible]", illegible: true });
  });
});

describe("PDF helpers", () => {
  it("detects scanned PDFs by near-empty pages", () => {
    expect(looksScanned(["", " ", "\n"])).toBe(true);
    expect(looksScanned([])).toBe(true);
    expect(looksScanned(["A process is a program in execution with its own address space."])).toBe(
      false,
    );
  });
  it("cleans hyphenation and blank runs", () => {
    expect(cleanPdfText("dead-\nlock\n\n\n\nnext")).toBe("deadlock\n\nnext");
  });
});

describe("sniffing", () => {
  it("recognises image magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg>"))).toBeNull();
  });
  it("recognises PDFs", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("hello"))).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows max hits per window then blocks until the window slides", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    expect(rl.check("ip").ok).toBe(true);
    expect(rl.check("ip").ok).toBe(true);
    const blocked = rl.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
    expect(rl.check("other").ok).toBe(true);
    now = 1001;
    expect(rl.check("ip").ok).toBe(true);
  });
});

describe("request schemas", () => {
  it("enforces notes length", () => {
    expect(NotesSchema.safeParse("short").success).toBe(false);
    expect(NotesSchema.safeParse("x".repeat(200)).success).toBe(true);
    expect(NotesSchema.safeParse("x".repeat(60_001)).success).toBe(false);
  });
  it("validates and normalises settings", () => {
    const ok = QuizSettingsSchema.parse({
      types: ["mcq", "mcq", "flashcard"],
      countPerType: 5,
      difficulty: "mixed",
      focus: "  ",
    });
    expect(ok.types).toEqual(["mcq", "flashcard"]);
    expect(ok.focus).toBeUndefined();
  });
  it("rejects bad settings", () => {
    const base = { types: ["mcq"], countPerType: 5, difficulty: "easy" };
    expect(QuizSettingsSchema.safeParse({ ...base, types: [] }).success).toBe(false);
    expect(QuizSettingsSchema.safeParse({ ...base, countPerType: 21 }).success).toBe(false);
    expect(QuizSettingsSchema.safeParse({ ...base, countPerType: 0 }).success).toBe(false);
    expect(QuizSettingsSchema.safeParse({ ...base, difficulty: "insane" }).success).toBe(false);
  });
});
