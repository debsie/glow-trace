import { useEffect, useState } from "react";

import { pickImage } from "@/lib/photo-intake";

/** Safari opens HEIC itself; other browsers on a computer cannot. */
const canOpenHeic = () =>
  typeof navigator !== "undefined" &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|android|crios|fxios|edg/i.test(navigator.userAgent);

/**
 * Photos dropped anywhere on the page or pasted (Ctrl/Cmd+V, or Paste on a phone). Returns
 * whether a drag is over the page, for the drop overlay. Nothing leaves the device.
 */
export const usePhotoIntake = (
  onFile: (file: File) => void,
  onProblem: (problem: string) => void,
  enabled = true,
) => {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const take = (files: File[]) => {
      const result = pickImage(files, canOpenHeic());
      if ("file" in result) onFile(result.file);
      else onProblem(result.problem);
    };
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      take(Array.from(event.dataTransfer?.files ?? []));
    };
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      // Leave pasted text in text fields alone; only photos are taken.
      event.preventDefault();
      take(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [enabled, onFile, onProblem]);

  return dragging;
};
