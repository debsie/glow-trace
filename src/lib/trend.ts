/**
 * Is a change between scans real, or just noise? A local-level Kalman filter: each scan is a
 * noisy reading of a slowly drifting true level. The filter weighs a new reading against what it
 * already believes, by how noisy readings are (measured) and how fast skin, hair and nails
 * change (assumed slow). Pure and deterministic.
 */

export type Reading = { at: string; value: number };

export type TrendModel = {
  /** Standard deviation of a single reading, in score points (from repeat-photo tests). */
  readingSd: number;
  /** How much the true level may drift per day, as a variance in points². */
  driftPerDay: number;
};

export type TrendEstimate = {
  /** Filtered level at the latest reading. */
  level: number;
  /** Filtered change since the previous reading. */
  change: number;
  /** Probability (0-1) that the true level moved in the direction of `change`. */
  certainty: number;
};

/** Slow by default: about ±5 points of real change over two months is plausible. */
export const DEFAULT_DRIFT_PER_DAY = 0.5;
const PRIOR_VARIANCE = 400;
const DAY_MS = 86_400_000;

/** Standard normal CDF, Abramowitz and Stegun 7.1.26 (error under 1.5e-7). */
export const normalCdf = (z: number): number => {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-((z * z) / 2));
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};

/** Filter readings (any order) and estimate the latest level and the change behind it. */
export const estimateTrend = (
  readings: readonly Reading[],
  model: TrendModel,
): TrendEstimate | null => {
  const sorted = [...readings].sort((a, b) => a.at.localeCompare(b.at));
  const first = sorted[0];
  if (!first) return null;
  const R = model.readingSd ** 2;
  let level = first.value;
  let variance = Math.min(PRIOR_VARIANCE, R);
  let previousLevel = level;
  let previousVariance = variance;
  for (let i = 1; i < sorted.length; i += 1) {
    const reading = sorted[i];
    const before = sorted[i - 1];
    if (!reading || !before) continue;
    const days = Math.max(0, (Date.parse(reading.at) - Date.parse(before.at)) / DAY_MS);
    previousLevel = level;
    previousVariance = variance;
    const predicted = variance + model.driftPerDay * days;
    const gain = predicted / (predicted + R);
    level += gain * (reading.value - level);
    variance = (1 - gain) * predicted;
  }
  if (sorted.length < 2) return { level, change: 0, certainty: 0.5 };
  const change = level - previousLevel;
  // The two estimates share data, so adding their variances overstates the spread: conservative.
  const spread = Math.sqrt(previousVariance + variance);
  return { level, change, certainty: normalCdf(Math.abs(change) / (spread || 1)) };
};
