"use client";

import { useRef, useState } from "react";
import { Camera, FileText, Loader2, ScanLine, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { extractPdf } from "@/lib/client/api";
import { renderPdfToImages } from "@/lib/client/pdf-render";
import { MAX_PDF_BYTES, MAX_PDF_RENDER_PAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type PdfState =
  | { kind: "idle" }
  | { kind: "extracting"; name: string }
  | { kind: "done"; name: string; pageCount: number; chars: number }
  | { kind: "scanned"; name: string; pageCount: number; file: File }
  | { kind: "rendering"; name: string };

interface PdfPanelProps {
  onText: (text: string) => void;
  /** Scanned-PDF fallback: hand rendered page images to the photo pipeline. */
  onPagesAsPhotos: (images: Blob[], sourceName: string) => void;
}

export function PdfPanel({ onText, onPagesAsPhotos }: PdfPanelProps) {
  const [state, setState] = useState<PdfState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = state.kind === "extracting" || state.kind === "rendering";

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error("PDFs must be 10 MB or smaller.");
      return;
    }
    setState({ kind: "extracting", name: file.name });
    try {
      const result = await extractPdf(file);
      if (result.scanned) {
        setState({ kind: "scanned", name: file.name, pageCount: result.pageCount, file });
        return;
      }
      onText(result.text);
      setState({
        kind: "done",
        name: file.name,
        pageCount: result.pageCount,
        chars: result.text.length,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that PDF.");
      setState({ kind: "idle" });
    }
  }

  async function readAsPhotos(file: File) {
    setState({ kind: "rendering", name: file.name });
    try {
      const { images } = await renderPdfToImages(file);
      onPagesAsPhotos(images, file.name);
      setState({ kind: "idle" });
    } catch {
      toast.error("Couldn't render the PDF pages. Try taking photos of them instead.");
      setState({ kind: "idle" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF: drop it here or press Enter to browse"
        aria-busy={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) void handleFile(file);
        }}
        className={cn(
          "border-border flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-pink-50/40 px-6 py-10 text-center transition-colors duration-150 hover:bg-pink-50",
          dragging && "border-pink-400 bg-pink-50",
          busy && "cursor-wait opacity-70",
        )}
      >
        {busy ? (
          <Loader2 aria-hidden strokeWidth={1.5} className="size-7 animate-spin text-pink-600" />
        ) : (
          <UploadCloud aria-hidden strokeWidth={1.25} className="text-sage-500 size-8" />
        )}
        <p className="text-text text-sm">
          {state.kind === "extracting"
            ? `Reading ${state.name}…`
            : state.kind === "rendering"
              ? `Rendering pages of ${state.name}…`
              : "Drop a PDF here, or click to browse"}
        </p>
        <p className="text-muted-text text-xs">Up to 10 MB · text is extracted on the server</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      {state.kind === "extracting" && <Skeleton className="h-24" />}

      {state.kind === "done" && (
        <p className="text-muted-text flex items-center gap-2 text-sm">
          <FileText aria-hidden strokeWidth={1.5} className="text-sage-500 size-4" />
          <span>
            <span className="text-text">{state.name}</span> · {state.pageCount} page
            {state.pageCount === 1 ? "" : "s"} · {state.chars.toLocaleString()} characters
            extracted. Clean it up below before generating.
          </span>
        </p>
      )}

      {state.kind === "scanned" && (
        <div
          role="status"
          className="border-warning/40 bg-warning-bg flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <ScanLine
              aria-hidden
              strokeWidth={1.5}
              className="text-warning-text mt-0.5 size-5 shrink-0"
            />
            <div className="text-sm">
              <p className="text-warning-text font-medium">
                No selectable text found — this PDF may be scanned.
              </p>
              <p className="text-muted-text">
                We can read the pages like photos instead
                {state.pageCount > MAX_PDF_RENDER_PAGES
                  ? ` (first ${MAX_PDF_RENDER_PAGES} of ${state.pageCount} pages).`
                  : "."}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void readAsPhotos(state.file)}>
            <Camera aria-hidden strokeWidth={1.5} />
            Read it as photos instead
          </Button>
        </div>
      )}
    </div>
  );
}
