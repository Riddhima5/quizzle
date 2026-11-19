import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { isRetryable, withRetry } from "@/lib/retry";

const noSleep = () => Promise.resolve();

function apiError(status: number, headers: Record<string, string> = {}) {
  return Anthropic.APIError.generate(
    status,
    { type: "error", error: { type: "x", message: "boom" } },
    "boom",
    new Headers(headers),
  );
}

describe("isRetryable", () => {
  it("retries 429, 529 and 5xx", () => {
    expect(isRetryable(apiError(429))).toBe(true);
    expect(isRetryable(apiError(529))).toBe(true);
    expect(isRetryable(apiError(500))).toBe(true);
  });
  it("does not retry client errors", () => {
    expect(isRetryable(apiError(400))).toBe(false);
    expect(isRetryable(apiError(401))).toBe(false);
    expect(isRetryable(new Error("plain"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries transient errors then succeeds", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(529))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after 3 retries", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(apiError(529));
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBeInstanceOf(Anthropic.APIError);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("does not retry a 400", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(apiError(400));
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBeInstanceOf(
      Anthropic.BadRequestError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("honours retry-after", async () => {
    const delays: number[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(429, { "retry-after": "2" }))
      .mockResolvedValue("ok");
    await withRetry(fn, { sleep: noSleep, onRetry: (_a, d) => delays.push(d) });
    expect(delays).toEqual([2000]);
  });
});
