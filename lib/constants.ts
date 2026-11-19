/** Limits shared by client and server so both validate the same way. */
export const NOTES_MIN_CHARS = 200;
export const NOTES_MAX_CHARS = 60_000;

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES = 10;
/** Before client-side compression (Section 2.1). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Claude's per-image limit for base64 images; compressed photos are far below this. */
export const MAX_CLAUDE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_RENDER_PAGES = 10;

/** Client compression target (keeps us within Claude's recommended image size). */
export const IMAGE_MAX_EDGE_PX = 1568;
export const IMAGE_JPEG_QUALITY = 0.85;

export const ACCEPTED_IMAGE_INPUT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
/** What the server forwards to Claude (HEIC is converted in the browser first). */
export const SERVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ServerImageType = (typeof SERVER_IMAGE_TYPES)[number];

export const COUNT_MIN = 1;
export const COUNT_MAX = 20;
export const COUNT_DEFAULT = 5;

export const ILLEGIBLE_TOKEN = "[illegible]";
