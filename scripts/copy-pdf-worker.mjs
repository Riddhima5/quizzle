// Copies the pdf.js worker into /public so the browser can load it from a stable URL
// (avoids bundler-specific worker handling). Runs on postinstall / predev / prebuild.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "build",
  "pdf.worker.min.mjs",
);
const destDir = join(process.cwd(), "public");
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "pdf.worker.min.mjs"));
console.log("pdf.worker.min.mjs copied to /public");
