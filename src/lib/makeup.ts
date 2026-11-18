import type { ScanReport } from "./types";

/**
 * Makeup base and prep from a skin scan, for people and their makeup artists. Every line comes
 * from a measured readout; nothing is fixed text. Thresholds:
 * - Depth from ITA° (Chardon et al., 1991 skin categories): >55 very light, 41-55 light,
 *   28-41 intermediate, 10-28 tan, -30-10 brown, below -30 dark.
 * - Undertone from hue angle atan2(b*, a*), split around the SCIN sample (median 55°, 10th
 *   percentile 39°, 90th 69°): under 48 cool (pink), over 60 warm (golden), between neutral.
 *   Light colour shifts this, so it is marked unsure when the scan warned about the light.
 * - Finish from hydration, correctors from redness and colour evenness, primer from texture.
 */

export type MakeupPrep = {
  depth: string;
  undertone: "Cool (pink)" | "Neutral" | "Warm (golden)";
  undertoneSure: boolean;
  finish: string;
  correctors: string[];
  primer: string;
  prep: string[];
};

const DEPTHS: { above: number; label: string }[] = [
  { above: 55, label: "Very light" },
  { above: 41, label: "Light" },
  { above: 28, label: "Light-medium" },
  { above: 10, label: "Medium (tan)" },
  { above: -30, label: "Deep" },
  { above: -Infinity, label: "Rich deep" },
];

const metric = (report: ScanReport, key: string): number | null =>
  report.metrics.find((item) => item.key === key)?.value ?? null;

export const depthFor = (ita: number): string =>
  DEPTHS.find((band) => ita > band.above)?.label ?? "Rich deep";

export const undertoneFor = (hueAngle: number): MakeupPrep["undertone"] =>
  hueAngle < 48 ? "Cool (pink)" : hueAngle > 60 ? "Warm (golden)" : "Neutral";

/** Null when the scan has no tone readout (not skin, or too little skin in the photo). */
export const makeupPrep = (report: ScanReport): MakeupPrep | null => {
  if (report.category !== "skin" || !report.tone || report.metrics.length === 0) return null;
  const { ita, hueAngle } = report.tone;
  const redness = metric(report, "erythema") ?? 0;
  const hydration = metric(report, "hydration") ?? 70;
  const texture = metric(report, "texture") ?? 0;
  const evenness = metric(report, "discoloration") ?? 0;
  const deep = ita <= 10;

  const correctors: string[] = [];
  if (redness >= 55) correctors.push("Green-tinted corrector, thinly, on red areas only");
  if (evenness >= 35) {
    correctors.push(
      deep
        ? "Orange or red corrector on darker patches before foundation"
        : "Peach corrector on darker patches before foundation",
    );
  }

  const finish =
    hydration < 55
      ? "Dewy or satin. Powder only where you shine"
      : hydration < 75
        ? "Satin"
        : "Natural or soft matte, as you prefer";

  const primer =
    texture >= 50
      ? "Smoothing (blurring) primer, pressed into uneven areas"
      : hydration < 55
        ? "Hydrating primer"
        : "Light primer, or none";

  const prep: string[] = [];
  if (hydration < 55) prep.push("Hydrating serum and moisturiser, then wait 10 minutes");
  if (redness >= 55) prep.push("Calming, fragrance-free products; no exfoliating on the day");
  if (texture >= 50) prep.push("Thin layers of base; build only where needed");
  if (prep.length === 0) prep.push("Your usual moisturiser and sunscreen, then base");

  return {
    depth: depthFor(ita),
    undertone: undertoneFor(hueAngle),
    undertoneSure: !report.quality.warning,
    finish,
    correctors,
    primer,
    prep,
  };
};
