import type { Motif } from "@/components/art/line-art";

import { TOPICS } from "./agent/knowledge";
import type { Topic } from "./agent/knowledge";

/**
 * Glow Guides: the agent's knowledge topics as a browsable library, grouped by area, each with
 * its line-art motif. Pure, so it is tested.
 */
export type GuideArea = "skin" | "hair" | "nails" | "everyday";

export const GUIDE_AREAS: readonly { id: GuideArea; label: string; lead: string }[] = [
  { id: "skin", label: "Skin", lead: "Marks, redness, breakouts, sunscreen and actives." },
  { id: "hair", label: "Hair", lead: "Length, coils, braids, edges, scalp and shine." },
  { id: "nails", label: "Nails", lead: "Stains, ridges, cuticles and manicures." },
  { id: "everyday", label: "Everyday", lead: "Scanning well, your scores, privacy and habits." },
];

const META: Record<string, { area: GuideArea; motif: Motif }> = {
  pigmentation: { area: "skin", motif: "spots" },
  sunscreen: { area: "skin", motif: "sun" },
  "dark-circles": { area: "skin", motif: "eye" },
  "nose-redness": { area: "skin", motif: "face" },
  "skin-type": { area: "skin", motif: "drop" },
  breakouts: { area: "skin", motif: "spots" },
  "makeup-skin": { area: "skin", motif: "lips" },
  ashy: { area: "skin", motif: "drop" },
  "texture-pores": { area: "skin", motif: "face" },
  retinol: { area: "skin", motif: "flask" },
  niacinamide: { area: "skin", motif: "flask" },
  "vitamin-c": { area: "skin", motif: "flask" },
  acids: { area: "skin", motif: "flask" },
  pregnancy: { area: "skin", motif: "leaf" },
  "hair-length": { area: "hair", motif: "strands" },
  shrinkage: { area: "hair", motif: "coil" },
  "protective-styles": { area: "hair", motif: "braid" },
  edges: { area: "hair", motif: "comb" },
  "relaxer-heat": { area: "hair", motif: "comb" },
  "hair-dry": { area: "hair", motif: "strands" },
  shine: { area: "hair", motif: "strands" },
  scalp: { area: "hair", motif: "comb" },
  "grey-hair": { area: "hair", motif: "strands" },
  thinning: { area: "hair", motif: "comb" },
  "nail-yellow": { area: "nails", motif: "nail" },
  "nail-ridges": { area: "nails", motif: "nail" },
  cuticles: { area: "nails", motif: "hand" },
  "gel-acrylic": { area: "nails", motif: "hand" },
  "scan-tips": { area: "everyday", motif: "chart" },
  scores: { area: "everyday", motif: "chart" },
  privacy: { area: "everyday", motif: "shield" },
  "water-diet": { area: "everyday", motif: "leaf" },
};

export type Guide = Topic & { area: GuideArea; motif: Motif };

export const GUIDES: readonly Guide[] = TOPICS.map((topic) => ({
  ...topic,
  area: META[topic.id]?.area ?? "everyday",
  motif: META[topic.id]?.motif ?? "leaf",
}));

export const guideById = (id: string): Guide | null =>
  GUIDES.find((guide) => guide.id === id) ?? null;

/** Other guides in the same area, nearest first in the library's order. */
export const relatedGuides = (guide: Guide, count = 3): Guide[] => {
  const same = GUIDES.filter((other) => other.area === guide.area && other.id !== guide.id);
  const index = GUIDES.findIndex((other) => other.id === guide.id);
  return [...same]
    .sort((a, b) => Math.abs(GUIDES.indexOf(a) - index) - Math.abs(GUIDES.indexOf(b) - index))
    .slice(0, count);
};

/** Indicator label (lower case) to the guide that helps with it. */
const GUIDE_FOR_FINDING: Record<string, string> = {
  redness: "nose-redness",
  texture: "texture-pores",
  hydration: "ashy",
  "even tone": "pigmentation",
  porosity: "hair-dry",
  shine: "shine",
  "density variance": "thinning",
  thinning: "thinning",
  yellowness: "nail-yellow",
  staining: "nail-yellow",
  ridges: "nail-ridges",
  "ridge texture": "nail-ridges",
  spots: "nail-ridges",
};

const dayIndex = (day: string) => {
  let hash = 0;
  for (const char of day) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
};

/**
 * Today's guide: the one for the person's weakest indicator that needs care, otherwise a guide
 * that changes each day (the same all day).
 */
export const guideOfTheDay = (
  findings: readonly { label: string; severity: string; health: number }[],
  day: string,
): { guide: Guide; why: "reading" | "daily" } => {
  const needs = [...findings]
    .filter((finding) => finding.severity !== "good")
    .sort((a, b) => a.health - b.health);
  for (const finding of needs) {
    const guide = guideById(GUIDE_FOR_FINDING[finding.label.toLowerCase()] ?? "");
    if (guide) return { guide, why: "reading" };
  }
  const daily = GUIDES[dayIndex(day) % GUIDES.length] ?? GUIDES[0];
  if (!daily) throw new Error("No guides");
  return { guide: daily, why: "daily" };
};
