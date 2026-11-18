/**
 * Copies the MediaPipe WebAssembly runtime (Apache-2.0) from node_modules into public/, so the
 * face guide loads it from this site. Run before dev and build; the copies are not committed.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join("public", "mediapipe", "wasm");
mkdirSync(to, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
  copyFileSync(join(from, file), join(to, file));
}

// Tesseract OCR (Apache-2.0) for reading ingredient labels on the device, plus its English
// model (MIT). Served from /ocr so no label photo or text leaves the device.
const ocr = join("public", "ocr");
mkdirSync(ocr, { recursive: true });
copyFileSync(
  join("node_modules", "tesseract.js", "dist", "worker.min.js"),
  join(ocr, "worker.min.js"),
);
for (const file of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-lstm.js",
  "tesseract-core-simd-lstm.js",
]) {
  copyFileSync(join("node_modules", "tesseract.js-core", file), join(ocr, file));
}
copyFileSync(
  join("node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"),
  join(ocr, "eng.traineddata.gz"),
);
