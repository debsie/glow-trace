/**
 * Reads text from a label photo on the device with Tesseract (Apache-2.0). Every file is served
 * from this site (/ocr, copied by scripts/copy-mediapipe.ts); the photo and text never leave the
 * device. Browser only: loaded on demand from the ingredient check.
 */
export const OCR_DOWNLOAD_MB = 7;

export const readLabel = async (photo: Blob): Promise<string> => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    workerBlobURL: false,
    gzip: true,
  });
  try {
    const result = await worker.recognize(photo);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
};
