/**
 * Picking the photo out of whatever was dropped, pasted or chosen: the first image, with a plain
 * reason when there is none or the browser cannot open it. Pure, so it is tested.
 */
export type Intake = { file: File } | { problem: string };

const isHeic = (file: { name: string; type: string }) =>
  /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

export const HEIC_PROBLEM =
  "That's an iPhone HEIC photo, which this browser can't open. Choose it on your iPhone instead (it converts itself), or export it as JPEG first.";

export const pickImage = (files: readonly File[], canOpenHeic: boolean): Intake => {
  const images = files.filter((file) => file.type.startsWith("image/") || isHeic(file));
  const [first] = images;
  if (!first) {
    return {
      problem:
        files.length > 0
          ? "That isn't a photo. Drop or paste a JPEG, PNG or WebP image."
          : "Nothing to read there. Try copying the photo again.",
    };
  }
  if (isHeic(first) && !canOpenHeic) return { problem: HEIC_PROBLEM };
  return { file: first };
};
