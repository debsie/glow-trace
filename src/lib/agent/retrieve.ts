import type { ScanRecord } from "../types";
import { intentFor } from "./agent";
import type { Finding, Intent } from "./agent";
import { TOPICS } from "./knowledge";
import type { Topic, TopicContext } from "./knowledge";

/**
 * Finding the right answer for a typed question, on the device. Every topic's key phrases are
 * scored against the question (whole phrases count more than single words, and word endings
 * are loosened so "braids" finds "braid"). A personal intent ("am I improving") competes with
 * the topics; below a minimum score the agent offers its closest topics instead of guessing.
 * Measured against src/test/agent-retrieve.test.ts, a set of real questions.
 */

const normalise = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Rough stem: drop common endings so plurals and verb forms match. */
const stem = (word: string) => word.replace(/(ing|ers|er|es|s|ed|y)$/, "").slice(0, 7);

const words = (text: string) => normalise(text).trim().split(" ").filter(Boolean);

const STOP = new Set([
  "my",
  "the",
  "a",
  "an",
  "is",
  "do",
  "i",
  "to",
  "and",
  "of",
  "on",
  "in",
  "it",
  "for",
  "how",
  "what",
  "why",
  "can",
  "should",
  "me",
  "with",
  "am",
  "are",
  "does",
  "your",
]);

const AREA_WORDS = {
  skin: /\b(skin|face|cheek|nose|forehead|chin)/,
  hair: /\b(hair|scalp|curl|coil|strand)/,
  nails: /\b(nail|cuticle|finger)/,
} as const;

const AREA_OF: Record<string, keyof typeof AREA_WORDS> = {
  pigmentation: "skin",
  sunscreen: "skin",
  "dark-circles": "skin",
  "nose-redness": "skin",
  "skin-type": "skin",
  breakouts: "skin",
  "makeup-skin": "skin",
  ashy: "skin",
  "texture-pores": "skin",
  retinol: "skin",
  niacinamide: "skin",
  "vitamin-c": "skin",
  acids: "skin",
  "hair-length": "hair",
  shrinkage: "hair",
  "protective-styles": "hair",
  edges: "hair",
  "relaxer-heat": "hair",
  "hair-dry": "hair",
  shine: "hair",
  scalp: "hair",
  "grey-hair": "hair",
  thinning: "hair",
  "nail-yellow": "nails",
  "nail-ridges": "nails",
  cuticles: "nails",
  "gel-acrylic": "nails",
};

export const scoreTopic = (question: string, topic: Topic): number => {
  const text = normalise(question);
  const stems = new Set(
    words(question)
      .filter((w) => !STOP.has(w))
      .map(stem),
  );
  let score = 0;
  for (const key of topic.keys) {
    // A whole phrase starting on a word boundary ("dark circle" also finds "dark circles"),
    // worth more the longer it is, so a named thing beats a generic question.
    const phrase = normalise(key).trimEnd();
    const keyWords = words(key).filter((w) => !STOP.has(w));
    if (text.includes(phrase)) {
      score += 3 + keyWords.length;
    } else if (keyWords.length > 1 && keyWords.every((w) => stems.has(stem(w)))) {
      score += 1 + keyWords.length;
    } else if (keyWords.length === 1 && keyWords[0] && stems.has(stem(keyWords[0]))) {
      score += 2;
    }
  }
  // The area the question names (hair, nails, skin) breaks ties between similar topics.
  if (score > 0) {
    const area = AREA_OF[topic.id];
    if (area && AREA_WORDS[area].test(text)) score += 2;
  }
  return score;
};

/** Personal intents ("am I improving", "what should I focus on") outrank topics at this score. */
const INTENT_SCORE = 3;
const MIN_TOPIC_SCORE = 2;

export type Route =
  | { kind: "intent"; intent: Intent }
  | { kind: "topic"; topic: Topic }
  | { kind: "unsure"; suggestions: Topic[] };

export const route = (question: string): Route => {
  const ranked = TOPICS.map((topic) => ({ topic, score: scoreTopic(question, topic) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const intent = intentFor(question);
  if (intent && (!best || best.score <= INTENT_SCORE)) return { kind: "intent", intent };
  if (best && best.score >= MIN_TOPIC_SCORE) return { kind: "topic", topic: best.topic };
  if (intent) return { kind: "intent", intent };
  return { kind: "unsure", suggestions: ranked.slice(0, 3).map((entry) => entry.topic) };
};

/** The topic's answer, with the person's own line first when there is one. */
export const topicAnswer = (topic: Topic, context: TopicContext): string[] => {
  const personal = topic.personal?.(context) ?? null;
  return personal ? [personal, ...topic.body] : [...topic.body];
};

/** The person's latest results, for the personal line: findings plus the newest report details. */
export const topicContext = (
  scans: readonly ScanRecord[],
  findings: readonly Finding[],
  shelf: readonly string[],
): TopicContext => {
  const newest = [...scans]
    .filter((scan) => !scan.demo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = <T>(pick: (scan: ScanRecord) => T | undefined): T | null => {
    for (const scan of newest) {
      const value = pick(scan);
      if (value) return value;
    }
    return null;
  };
  return {
    findings: new Map(
      findings.map((finding) => [
        finding.label.toLowerCase(),
        { health: finding.health, trend: finding.trend, area: finding.area },
      ]),
    ),
    face: latest((scan) => scan.report?.face),
    zones: latest((scan) => scan.report?.zones),
    hairLength: latest((scan) => scan.report?.hairLength),
    shelf,
  };
};
