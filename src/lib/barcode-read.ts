/**
 * Reads a barcode from a photo on the device: the browser's own barcode reader where it has one
 * (Chrome on Android), otherwise ZXing (MIT), loaded on demand. Browser only.
 */
type Detector = { detect: (image: ImageBitmap) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

export const readBarcode = async (photo: Blob): Promise<string | null> => {
  const native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (native) {
    try {
      const bitmap = await createImageBitmap(photo);
      const found = await new native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(
        bitmap,
      );
      bitmap.close();
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch {
      // Fall through to ZXing.
    }
  }
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const url = URL.createObjectURL(photo);
  try {
    const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return result.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};
