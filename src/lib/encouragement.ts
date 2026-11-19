import { findingsFor } from "./agent/agent";
import type { Finding } from "./agent/agent";
import { shortDate } from "./progress";
import type { ScanCategory, ScanRecord } from "./types";

/**
 * The good news, said plainly. Strengths (indicators reading well), real improvements (the trend
 * filter is at least 95% sure, so never noise) and steady check-ins. Pure, so it is tested; no
 * exclamation marks, no claims beyond the readings, never a diagnosis.
 */

export type Cheer = {
  /** Short, warm summary for the area, or null when there is nothing honest to celebrate yet. */
  headline: string | null;
  /** Specific lines: improvements first, then strengths, then consistency. */
  lines: string[];
};

const AREA_WORD: Record<ScanCategory, string> = { skin: "skin", hair: "hair", nails: "nails" };

const ALL_GOOD: Record<ScanCategory, string> = {
  skin: "Your skin is in a really good place right now. Whatever you're doing, it's working.",
  hair: "Your hair is in great shape. Your routine is clearly paying off.",
  nails: "Your nails look strong and healthy. Keep doing what you're doing.",
};

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

/** Distinct calendar weeks with a real scan of this area in the last `weeks` weeks. */
export const weeksCheckedIn = (
  scans: readonly ScanRecord[],
  area: ScanCategory,
  now: Date,
  weeks = 4,
): number => {
  const week = 7 * 24 * 60 * 60 * 1000;
  const seen = new Set<number>();
  for (const scan of scans) {
    if (scan.category !== area || scan.demo) continue;
    const age = now.getTime() - new Date(scan.created_at).getTime();
    if (age >= 0 && age < weeks * week) seen.add(Math.floor(age / week));
  }
  return seen.size;
};

const improvementLine = (finding: Finding, since: string | null): string => {
  const points = Math.abs(finding.change ?? 0).toFixed(1);
  const when = since ? ` since ${since}` : "";
  return `Your ${lower(finding.label)} has improved by ${points} points${when}. That's a real change, not a lucky photo.`;
};

export const cheerFor = (
  scans: readonly ScanRecord[],
  area: ScanCategory,
  now: Date = new Date(),
): Cheer => {
  const findings = findingsFor(scans).filter((finding) => finding.area === area);
  if (findings.length === 0) return { headline: null, lines: [] };
  const history = scans
    .filter((scan) => scan.category === area && !scan.demo)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = history[0];
  const since = history.length > 1 && first ? shortDate(first.created_at) : null;

  const improved = findings.filter((finding) => finding.trend === "improving");
  const strengths = findings.filter((finding) => finding.severity === "good");
  const lines = [
    ...improved.map((finding) => improvementLine(finding, since)),
    ...strengths
      .filter((finding) => !improved.includes(finding))
      .slice(0, 3)
      .map(
        (finding) => `${finding.label} is a strength. Protect it with what you're already doing.`,
      ),
  ];
  const weeks = weeksCheckedIn(scans, area, now);
  if (weeks >= 3) {
    lines.push(
      `You've checked your ${AREA_WORD[area]} ${weeks} weeks running. Steady check-ins are what make the trends trustworthy.`,
    );
  }

  const allGood = strengths.length === findings.length;
  const headline = allGood
    ? ALL_GOOD[area]
    : improved.length > 0
      ? `Real progress on your ${AREA_WORD[area]}. Keep going, it's working.`
      : strengths.length > 0
        ? `There's plenty going right with your ${AREA_WORD[area]}.`
        : null;
  return { headline, lines };
};
