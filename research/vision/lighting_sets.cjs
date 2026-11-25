// Lighting-challenge analysis (docs/release-readiness.md, checks 2, 3 and 5), on this machine only.
//
// Input: a manifest JSON exported from training_photos (see research/vision/README.md):
//   [{ "path": "<user id>/<uuid>.jpg", "set_id": "...", "lighting": "daylight", "file": "<local jpg>" }]
// The person is the first folder of `path`. Needs the dev server on 127.0.0.1:8091.
// Usage: node research/vision/lighting_sets.cjs manifest.json > report.json
//
// Reports, per skin indicator:
//   light   - within one set (same person, minutes apart, daylight / indoor / dim): mean range
//   repeat  - same person, same light, different sets: pooled standard deviation of one reading
//   floor   - measured noise floor, 2 x repeat SD (what NOISE_BY_CONCERN / TREND_NOISE should be)
//   current - the floor the trend uses today (redness 8, everything else 2)
// and coverage: people per skin-tone band (ITA 41 / 28 / 10), the release bar wanting 5 each.
const { chromium } = require("playwright");
const fs = require("fs");

const CURRENT = { erythema: 8, noseRedness: 8 };
const band = (ita) => (ita > 41 ? 0 : ita > 28 ? 1 : ita > 10 ? 2 : 3);
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

(async () => {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8091/", { waitUntil: "networkidle" });
  const rows = [];
  for (const item of manifest) {
    const b64 = fs.readFileSync(item.file).toString("base64");
    const out = await page.evaluate(async (b64) => {
      const g = await import("/src/lib/cv/guides.ts");
      const im = await import("/src/lib/cv/image.ts");
      const k = await import("/src/lib/cv/kernel.ts");
      const s = await import("/src/lib/cv/skin-surface-model.ts");
      const blob = await (await fetch("data:image/jpeg;base64," + b64)).blob();
      const pixels = await im.loadImageData(blob, im.MAX_DIM);
      const face = await g.findFace(await im.loadImageData(blob, im.PHOTO_DIM));
      if (!face) return null;
      const mask = face.skinAt(pixels.width, pixels.height);
      if (!mask) return null;
      const big = await im.loadImageData(blob, s.TEXTURE_PHOTO_DIM);
      const bigMask = face.skinAt(big.width, big.height);
      const report = k.analyzeBiomarkers("skin", pixels, mask, {
        faceAreas: face.areasAt(pixels.width, pixels.height),
        skinTexture: bigMask ? await s.skinTextureSignalFast(big, bigMask) : null,
      });
      if (!report.quality.usable) return null;
      const values = Object.fromEntries(report.metrics.map((m) => [m.key, m.value]));
      if (report.face) {
        values.noseRedness = report.face.noseRedness;
        values.darkCircles = report.face.darkCircles;
      }
      return { values, ita: report.tone ? report.tone.ita : null };
    }, b64);
    const person = item.path.split("/")[0];
    if (!out) {
      console.error(`skipped (no face or unusable): ${item.path}`);
      continue;
    }
    rows.push({ person, set: item.set_id, lighting: item.lighting, ...out });
  }
  await browser.close();

  const people = [...new Set(rows.map((r) => r.person))];
  const bandOf = {};
  for (const p of people) {
    const itas = rows
      .filter((r) => r.person === p && r.ita !== null)
      .map((r) => r.ita)
      .sort((a, b) => a - b);
    if (itas.length) bandOf[p] = band(itas[Math.floor(itas.length / 2)]);
  }
  const coverage = [0, 1, 2, 3].map((b) => people.filter((p) => bandOf[p] === b).length);
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.values)))];
  const indicators = {};
  for (const key of keys) {
    const has = (r) => typeof r.values[key] === "number";
    const byBand = (filter) =>
      [0, 1, 2, 3].map((b) => filter(rows.filter((r) => bandOf[r.person] === b)));
    // Light: range across lights within each set.
    const lightRange = (rs) => {
      const sets = [...new Set(rs.map((r) => r.set))];
      return round1(
        mean(
          sets.flatMap((set) => {
            const v = rs.filter((r) => r.set === set && has(r)).map((r) => r.values[key]);
            return v.length > 1 ? [Math.max(...v) - Math.min(...v)] : [];
          }),
        ),
      );
    };
    // Repeat: pooled SD over (person, lighting) groups with two or more readings.
    const repeatSd = (rs) => {
      let ss = 0;
      let df = 0;
      const groups = new Map();
      for (const r of rs.filter(has)) {
        const id = `${r.person}|${r.lighting}`;
        groups.set(id, [...(groups.get(id) ?? []), r.values[key]]);
      }
      for (const v of groups.values()) {
        if (v.length < 2) continue;
        const m = mean(v);
        ss += v.reduce((a, x) => a + (x - m) ** 2, 0);
        df += v.length - 1;
      }
      return df ? Math.sqrt(ss / df) : null;
    };
    const sd = repeatSd(rows);
    indicators[key] = {
      current: CURRENT[key] ?? 2,
      light: lightRange(rows),
      lightByBand: byBand(lightRange),
      repeatSd: round1(sd),
      floor: sd === null ? null : round1(2 * sd),
      floorByBand: byBand((rs) => {
        const v = repeatSd(rs);
        return v === null ? null : round1(2 * v);
      }),
    };
  }
  console.log(
    JSON.stringify({ people: people.length, photos: rows.length, coverage, indicators }, null, 2),
  );
})().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
