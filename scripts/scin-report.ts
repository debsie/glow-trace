/**
 * Skin-tone fairness check on Google's SCIN dataset (SCIN Data Use License).
 *
 * Downloads a small, stratified sample of close-up photos one at a time, scores each with the
 * same kernel the app uses, deletes the photo, and writes only aggregate statistics. No image or
 * per-person record is kept. SCIN has no redness labels, so this checks fairness and stability
 * across skin tones, not accuracy.
 *
 * Usage: bun scripts/scin-report.ts <folder with scin_cases.csv and scin_labels.csv> [perGroup]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { analyzeBiomarkers } from "../src/lib/cv/kernel";
import { MAX_DIM, toPlanes } from "../src/lib/cv/image";
import { correctLight, densityDifferences, estimateIlluminant } from "../src/lib/cv/pigment";
import type { Illuminant } from "../src/lib/cv/pigment";
import type { PixelBuffer } from "../src/lib/cv/types";

const BUCKET = "https://storage.googleapis.com/dx-scin-public-data/";

/** Minimal CSV parser: quoted fields, commas and doubled quotes. */
const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header = [], ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
};

const GROUPS: Record<string, number[]> = {
  "Monk 1-2 (lightest)": [1, 2],
  "Monk 3-4": [3, 4],
  "Monk 5-6": [5, 6],
  "Monk 7-10 (deepest)": [7, 8, 9, 10],
};

// Conditions dermatologists usually describe as red, versus mostly pigment-related ones.
// A rough proxy only: a condition label is not a redness measurement.
const RED_CONDITIONS = [
  "Urticaria",
  "Eczema",
  "Allergic Contact Dermatitis",
  "Psoriasis",
  "Rosacea",
];
const PIGMENT_CONDITIONS = [
  "Melanocytic Nevus",
  "Seborrheic Keratosis",
  "Post-Inflammatory hyperpigmentation",
  "Hyperpigmentation",
];

const topCondition = (label: string): string => {
  const match = /'([^']+)':\s*([\d.]+)/.exec(label);
  return match?.[1] ?? "";
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? NaN
    : sorted.length % 2
      ? (sorted[mid] ?? NaN)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

const main = async () => {
  const folder = process.argv[2];
  const perGroup = Number(process.argv[3] ?? 40);
  if (!folder) throw new Error("Pass the folder holding the SCIN CSV files");
  const cases = new Map(
    parseCsv(readFileSync(join(folder, "scin_cases.csv"), "utf8")).map((row) => [row.case_id, row]),
  );
  const labels = parseCsv(readFileSync(join(folder, "scin_labels.csv"), "utf8"));

  // Deterministic stratified sample of close-up photos per skin-tone group.
  const sample: { group: string; path: string; condition: string }[] = [];
  for (const [group, tones] of Object.entries(GROUPS)) {
    const picked = labels
      .filter((label) => tones.includes(Number(label.monk_skin_tone_label_us)))
      .map((label) => ({ label, row: cases.get(label.case_id) }))
      .filter(({ row }) => row?.image_1_shot_type === "CLOSE_UP" && row.image_1_path)
      .sort((a, b) => (a.label.case_id ?? "").localeCompare(b.label.case_id ?? ""))
      .slice(0, perGroup);
    for (const { label, row } of picked) {
      sample.push({
        group,
        path: row?.image_1_path ?? "",
        condition: topCondition(label.weighted_skin_condition_label ?? ""),
      });
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  type Result = {
    group: string;
    condition: string;
    usable: boolean;
    notice?: string | undefined;
    warning: boolean;
    metrics: Record<string, number>;
  };
  const results: Result[] = [];
  const raw: Record<string, number | string>[] = [];
  const kept: { group: string; condition: string; image: PixelBuffer }[] = [];
  for (const [index, item] of sample.entries()) {
    const response = await fetch(BUCKET + item.path);
    if (!response.ok) continue;
    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    // Decode and downscale in Chromium, exactly as the app does in the browser.
    const decoded = await page.evaluate(
      async ({ data, maxDim }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = Object.assign(document.createElement("canvas"), { width, height });
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("no canvas");
        context.drawImage(img, 0, 0, width, height);
        return {
          width,
          height,
          pixels: Array.from(context.getImageData(0, 0, width, height).data),
        };
      },
      { data: base64, maxDim: MAX_DIM },
    );
    const image: PixelBuffer = {
      width: decoded.width,
      height: decoded.height,
      data: Uint8ClampedArray.from(decoded.pixels),
    };
    const report = analyzeBiomarkers("skin", image);
    kept.push({ group: item.group, condition: item.condition, image });
    const planes = toPlanes(image);
    const skinA: number[] = [];
    const skinL: number[] = [];
    const skinB: number[] = [];
    const skinHue: number[] = [];
    const allA: number[] = [];
    for (let i = 0; i < planes.count; i += 1) {
      const L = planes.labL[i] ?? 0;
      const a = planes.labA[i] ?? 0;
      const b = planes.labB[i] ?? 0;
      allA.push(a);
      const hue = (Math.atan2(b, a) * 180) / Math.PI;
      if (L > 20 && L < 95 && a > 2 && hue > 10 && hue < 80) {
        skinA.push(a);
        skinL.push(L);
        skinB.push(b);
        skinHue.push(hue);
      }
    }
    const skinMedian = median(skinA);
    raw.push({
      group: item.group,
      condition: item.condition,
      meanA: allA.reduce((x, y) => x + y, 0) / allA.length,
      skinShare: skinA.length / planes.count,
      skinMedianA: skinMedian,
      skinP90A: [...skinA].sort((x, y) => x - y)[Math.floor(skinA.length * 0.9)] ?? NaN,
      skinMedianL: median(skinL),
      skinMedianB: median(skinB),
      skinMedianHue: median(skinHue),
      hueP10: [...skinHue].sort((x, y) => x - y)[Math.floor(skinHue.length * 0.1)] ?? NaN,
      redShare: skinA.filter((a) => a > skinMedian + 6).length / Math.max(1, skinA.length),
    });
    results.push({
      group: item.group,
      condition: item.condition,
      usable: report.quality.usable,
      notice: report.quality.notice,
      warning: Boolean(report.quality.warning),
      metrics: Object.fromEntries(report.metrics.map((metric) => [metric.key, metric.value])),
    });
    if ((index + 1) % 20 === 0) console.error(`${index + 1} / ${sample.length}`);
  }
  await browser.close();

  // ---------- Candidate redness features (pigment physics, light correction) ----------
  const illuminants = kept.map((entry) => estimateIlluminant(entry.image));
  const med = (values: number[]) => median(values);
  const reference: Illuminant = {
    r: med(illuminants.map((e) => e.r)),
    g: med(illuminants.map((e) => e.g)),
    b: med(illuminants.map((e) => e.b)),
  };
  const features = (image: PixelBuffer) => {
    const planes = toPlanes(image);
    const dG: number[] = [];
    const dB: number[] = [];
    const la: number[] = [];
    const lb: number[] = [];
    for (let i = 0; i < planes.count; i += 1) {
      const L = planes.labL[i] ?? 0;
      const a = planes.labA[i] ?? 0;
      const b = planes.labB[i] ?? 0;
      const hue = (Math.atan2(b, a) * 180) / Math.PI;
      if (!(L > 20 && L < 95 && a > 2 && hue > 10 && hue < 80)) continue;
      const d = densityDifferences(
        image.data[i * 4] ?? 0,
        image.data[i * 4 + 1] ?? 0,
        image.data[i * 4 + 2] ?? 0,
      );
      dG.push(d.dG);
      dB.push(d.dB);
      la.push(a);
      lb.push(b);
    }
    return { dG: med(dG), dB: med(dB), a: med(la), b: med(lb), skin: dG.length / planes.count };
  };
  const candidates = kept.map((entry, index) => ({
    group: entry.group,
    condition: entry.condition,
    illuminant: illuminants[index],
    raw: features(entry.image),
    corrected: features(correctLight(entry.image, reference)),
  }));
  writeFileSync(join(folder, "candidates.json"), JSON.stringify({ reference, candidates }));

  // ---------- Aggregate report ----------
  const keys = ["erythema", "texture", "hydration", "discoloration"];
  const lines: string[] = [];
  lines.push(
    "| Skin tone (Monk, US graders) | Photos | Scored | Light warning | " +
      keys.map((key) => `${key} (median)`).join(" | ") +
      " |",
  );
  lines.push("|" + " --- |".repeat(4 + keys.length));
  for (const group of Object.keys(GROUPS)) {
    const inGroup = results.filter((result) => result.group === group);
    const scored = inGroup.filter((result) => result.usable);
    const medians = keys.map((key) => {
      const value = median(
        scored.map((result) => result.metrics[key] ?? NaN).filter(Number.isFinite),
      );
      return Number.isFinite(value) ? value.toFixed(1) : "n/a";
    });
    const pct = (part: number) =>
      inGroup.length ? `${Math.round((part / inGroup.length) * 100)}%` : "n/a";
    lines.push(
      `| ${group} | ${inGroup.length} | ${pct(scored.length)} | ${pct(inGroup.filter((result) => result.warning).length)} | ${medians.join(" | ")} |`,
    );
  }

  const rejections = new Map<string, number>();
  for (const result of results)
    if (!result.usable && result.notice)
      rejections.set(result.notice, (rejections.get(result.notice) ?? 0) + 1);

  const proxyLines: string[] = [];
  for (const group of Object.keys(GROUPS)) {
    const scored = results.filter((result) => result.group === group && result.usable);
    const red = scored
      .filter((result) => RED_CONDITIONS.includes(result.condition))
      .map((result) => result.metrics.erythema ?? NaN);
    const pigment = scored
      .filter((result) => PIGMENT_CONDITIONS.includes(result.condition))
      .map((result) => result.metrics.erythema ?? NaN);
    proxyLines.push(
      `| ${group} | ${red.length} | ${red.length ? median(red).toFixed(1) : "n/a"} | ${pigment.length} | ${pigment.length ? median(pigment).toFixed(1) : "n/a"} |`,
    );
  }

  const output = [
    `Sample: ${results.length} close-up photos, up to ${perGroup} per skin-tone group, scored with the app's kernel at ${MAX_DIM}px.`,
    "",
    "### Scores and quality by skin tone",
    "",
    ...lines,
    "",
    "### Why photos were not scored",
    "",
    ...(rejections.size === 0
      ? ["None rejected."]
      : [...rejections.entries()].map(([notice, count]) => `- ${notice}: ${count}`)),
    "",
    "### Redness proxy (condition labels, not measurements)",
    "",
    "| Skin tone | Usually-red conditions | Redness median | Pigment conditions | Redness median |",
    "| --- | --- | --- | --- | --- |",
    ...proxyLines,
  ].join("\n");
  writeFileSync(join(folder, "report.md"), output);
  writeFileSync(join(folder, "results.json"), JSON.stringify(results));
  writeFileSync(join(folder, "raw.json"), JSON.stringify(raw));
  console.log(output);
};

void main();
