import { describe, expect, it } from "vitest";

import { route, topicAnswer } from "@/lib/agent/retrieve";
import { TOPICS } from "@/lib/agent/knowledge";

/**
 * The agent's test set: questions the way people type them, and the answer they should get.
 * Add a row whenever a real question was answered badly; the agent must stay at 90% or better.
 */
const CASES: [string, string][] = [
  ["how do i get rid of dark marks from pimples", "pigmentation"],
  ["my melasma is getting worse", "pigmentation"],
  ["do I need sunscreen if I'm dark skinned", "sunscreen"],
  ["sunscreen leaves a white cast on me", "sunscreen"],
  ["why are my under eyes so dark", "dark-circles"],
  ["help with my dark circles", "dark-circles"],
  ["why is my nose always red", "nose-redness"],
  ["what is my skin type", "skin-type"],
  ["my t-zone is so oily", "skin-type"],
  ["I keep breaking out on my chin", "breakouts"],
  ["what helps with acne", "breakouts"],
  ["is it bad to sleep in makeup", "makeup-skin"],
  ["which foundation should I use", "makeup-skin"],
  ["my legs look ashy", "ashy"],
  ["how do I shrink my pores", "texture-pores"],
  ["how should I start retinol", "retinol"],
  ["can I use niacinamide every day", "niacinamide"],
  ["when should I use vitamin c", "vitamin-c"],
  ["what's the difference between aha and bha", "acids"],
  ["what skincare is safe while pregnant", "pregnancy"],
  ["my hair isn't growing", "hair-length"],
  ["how do I keep my length", "hair-length"],
  ["my 4c hair shrinks so much", "shrinkage"],
  ["how long can I keep box braids in", "protective-styles"],
  ["is wearing a wig bad for my hair", "protective-styles"],
  ["my edges are thinning", "edges"],
  ["how often should I relax my hair", "relaxer-heat"],
  ["does flat ironing damage hair", "relaxer-heat"],
  ["my hair is so dry and frizzy", "hair-dry"],
  ["how do I stop split ends", "hair-dry"],
  ["how to make my hair shiny", "shine"],
  ["I have dandruff", "scalp"],
  ["my scalp is itchy", "scalp"],
  ["how do I look after grey hair", "grey-hair"],
  ["my hair is falling out a lot", "thinning"],
  ["why are my nails yellow", "nail-yellow"],
  ["I have ridges on my nails", "nail-ridges"],
  ["should I cut my cuticles", "cuticles"],
  ["do acrylics ruin your nails", "gel-acrylic"],
  ["why did my score change", "scan-tips"],
  ["what does a score of 60 mean", "scores"],
  ["are my photos uploaded anywhere", "privacy"],
  ["does drinking water help my skin", "water-diet"],
  ["am I improving", "intent:progress"],
  ["what should I focus on", "intent:focus"],
  ["is my shelf safe to mix", "intent:conflicts"],
  ["which products should I use", "intent:products"],
];

const outcome = (question: string) => {
  const result = route(question);
  return result.kind === "topic"
    ? result.topic.id
    : result.kind === "intent"
      ? `intent:${result.intent}`
      : "unsure";
};

describe("Agent answers the questions people ask", () => {
  it("routes at least 90% of the test set correctly", () => {
    const misses = CASES.filter(([question, expected]) => outcome(question) !== expected).map(
      ([question, expected]) => `${question} -> ${outcome(question)} (wanted ${expected})`,
    );
    const accuracy = 1 - misses.length / CASES.length;
    expect(misses.length === 0 ? [] : misses).toEqual(accuracy >= 0.9 ? expect.any(Array) : []);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("offers suggestions instead of guessing on nonsense", () => {
    expect(route("purple monkey dishwasher").kind).toBe("unsure");
  });

  it("puts the person's own reading first", () => {
    const topic = TOPICS.find((t) => t.id === "dark-circles");
    if (!topic) throw new Error("missing topic");
    const lines = topicAnswer(topic, {
      findings: new Map(),
      face: { noseRedness: 40, darkCircles: 33.3, skinType: "balanced" },
      zones: null,
      hairLength: null,
      shelf: [],
    });
    expect(lines[0]).toMatch(/33\.3/);
  });

  it("never shouts or diagnoses", () => {
    for (const topic of TOPICS) {
      for (const line of topic.body) {
        expect(line).not.toMatch(/!/);
        expect(line).not.toMatch(/\byou have (a |an )?[a-z]+ (disease|condition|disorder)/i);
      }
    }
  });
});
