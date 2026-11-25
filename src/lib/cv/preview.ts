import type { ScanCategory } from "./types";

/**
 * Readings shown as "Preview" (docs/release-readiness.md): they appear on results, but count
 * towards no score, trend or insight until they pass the release bar. Decided by key, not stored,
 * so scans saved before this rule follow it too. Remove a key here once it passes.
 */
const PREVIEW: Record<ScanCategory, ReadonlySet<string>> = {
  // Even tone, hydration and texture vary too much between repeat photos of the same person.
  skin: new Set(["discoloration", "hydration", "texture"]),
  hair: new Set(),
  nails: new Set(),
};

export const isPreview = (category: ScanCategory, key: string): boolean =>
  PREVIEW[category].has(key);

export const PREVIEW_NOTE =
  "Preview: still being checked for steadiness, so it is not counted in your score or trends yet.";
