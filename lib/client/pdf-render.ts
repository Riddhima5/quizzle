"use client";

import { IMAGE_MAX_EDGE_PX, MAX_PDF_RENDER_PAGES } from "@/lib/constants";
import { canvasToJpeg } from "./image-prep";

/**
 * Render the first pages of a (scanned) PDF to JPEG images in the browser, so they can go
 * through the photo-transcription pipeline. Long edge capped at 1568 px.
 */
export async function renderPdfToImages(
  file: File,
  maxPages = MAX_PDF_RENDER_PAGES,
): Promise<{ images: Blob[]; totalPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const count = Math.min(doc.numPages, maxPages);
    const images: Blob[] = [];

    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = IMAGE_MAX_EDGE_PX / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(await canvasToJpeg(canvas));
      page.cleanup();
    }
    return { images, totalPages: doc.numPages };
  } finally {
    await task.destroy();
  }
}
