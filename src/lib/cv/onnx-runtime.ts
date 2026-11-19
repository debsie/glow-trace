import type { InferenceSession } from "onnxruntime-web";

/**
 * ONNX Runtime Web (MIT), bundled and served from this site.
 * Uses the phone's graphics chip through WebGPU where available, otherwise WebAssembly. Browser
 * only, loaded on demand. Photos and results never leave the device.
 */
const sessions = new Map<string, Promise<InferenceSession>>();

const session = async (url: string): Promise<InferenceSession> => {
  const ort = await import("onnxruntime-web/webgpu");
  const [{ default: wasm }, { default: mjs }] = await Promise.all([
    import("../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url"),
    import("../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url"),
  ]);
  ort.env.wasm.wasmPaths = { wasm, mjs };
  // Threads need cross-origin isolation, which the site does not turn on.
  ort.env.wasm.numThreads = 1;
  const pending =
    sessions.get(url) ??
    ort.InferenceSession.create(url, {
      executionProviders: "gpu" in navigator ? ["webgpu", "wasm"] : ["wasm"],
    });
  sessions.set(url, pending);
  pending.catch(() => sessions.delete(url));
  return pending;
};

/** Runs a 4-channel size x size input; returns the output maps, flat (heads x size x size). */
export const runModel = async (
  url: string,
  input: Float32Array,
  size: number,
): Promise<Float32Array> => {
  const ort = await import("onnxruntime-web/webgpu");
  const model = await session(url);
  const feeds = { input: new ort.Tensor("float32", input, [1, 4, size, size]) };
  const result = await model.run(feeds);
  const maps = result["maps"];
  if (!maps) throw new Error("Model returned no maps");
  return (await maps.getData()) as Float32Array;
};
