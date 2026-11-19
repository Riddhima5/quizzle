"use client";

import { IMAGE_JPEG_QUALITY, IMAGE_MAX_EDGE_PX } from "@/lib/constants";

/** Windows/Android often report HEIC with an empty MIME type, so check the extension too. */
export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Browser-side preparation before upload:
 *  1. HEIC → JPEG (heic2any)
 *  2. EXIF orientation fix + resize (long edge ≤ 1568 px) + JPEG q≈0.85 (browser-image-compression)
 * Both libraries touch `window` at import time, so they are imported lazily.
 */
export async function prepareImage(file: File): Promise<Blob> {
  let input: File = file;

  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error("HEIC conversion produced no image.");
    input = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  }

  const imageCompression = (await import("browser-image-compression")).default;
  return imageCompression(input, {
    maxWidthOrHeight: IMAGE_MAX_EDGE_PX,
    initialQuality: IMAGE_JPEG_QUALITY,
    fileType: "image/jpeg",
    maxSizeMB: 3,
    useWebWorker: true,
  });
}

/** Rotate an image 90° clockwise and re-encode as JPEG. */
export async function rotateImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return canvasToJpeg(canvas);
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
      "image/jpeg",
      IMAGE_JPEG_QUALITY,
    ),
  );
}
