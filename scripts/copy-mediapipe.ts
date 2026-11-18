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
