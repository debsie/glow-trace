// Real-photo gate for every skin indicator (docs/release-readiness.md, checks 2 and 3), through
// the app's own pipeline: face guide, skin mask, the skin-surface models and analyzeBiomarkers.
// Runs on this machine only, so consented photos never leave it.
//
// Needs the dev server on 127.0.0.1:8091 (npx vite dev --host 127.0.0.1 --port 8091).
// Usage: node research/vision/indicator_gate.cjs <person>=<photo> <person>=<photo> ...
//
// For each indicator, in its own points (0-100):
//   exposure  +/-20% brightness moves it by at most its noise floor
//   colour    a warm or cool light (red and blue +/-8%) moves it by at most its noise floor
//   same      repeat photos of one person span at most twice its noise floor
// Noise floors are the trend's (src/lib/agent/agent.ts): redness 8, everything else 2.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const NOISE = { erythema: 8, noseRedness: 8 };
const floor = (key) => NOISE[key] ?? 2;

const pairs = process.argv.slice(2);
if (pairs.length < 2) {
  console.error("Usage: node indicator_gate.cjs <person>=<photo> ... (2 or more)");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8091/", { waitUntil: "networkidle" });
  const rows = [];
  for (const pair of pairs) {
    const [person, file] = pair.split(/=(.*)/s);
    const b64 = fs.readFileSync(file).toString("base64");
    const result = await page.evaluate(async (b64) => {
      const g = await import("/src/lib/cv/guides.ts");
      const im = await import("/src/lib/cv/image.ts");
      const k = await import("/src/lib/cv/kernel.ts");
      const s = await import("/src/lib/cv/skin-surface-model.ts");
      const source = await (await fetch("data:image/jpeg;base64," + b64)).blob();
      const original = await createImageBitmap(source);
      // One version of the photo: brightness and red/blue gains, re-encoded as a phone would.
      const variant = async (gain, red, blue) => {
        const c = document.createElement("canvas");
        c.width = original.width;
        c.height = original.height;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(original, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
          d.data[i] = d.data[i] * gain * red;
          d.data[i + 1] = d.data[i + 1] * gain;
          d.data[i + 2] = d.data[i + 2] * gain * blue;
        }
        x.putImageData(d, 0, 0);
        return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      };
      const read = async (blob) => {
        const pixels = await im.loadImageData(blob, im.MAX_DIM);
        const large = await im.loadImageData(blob, im.PHOTO_DIM);
        const face = await g.findFace(large);
        if (!face) return null;
        const mask = face.skinAt(pixels.width, pixels.height);
        if (!mask) return null;
        const big = await im.loadImageData(blob, s.TEXTURE_PHOTO_DIM);
        const bigMask = face.skinAt(big.width, big.height);
        const skinTexture = bigMask ? await s.skinTextureSignalFast(big, bigMask) : null;
        const report = k.analyzeBiomarkers("skin", pixels, mask, {
          faceAreas: face.areasAt(pixels.width, pixels.height),
          skinTexture,
        });
        if (!report.quality.usable) return null;
        const out = Object.fromEntries(report.metrics.map((m) => [m.key, m.value]));
        if (report.face) {
          out.noseRedness = report.face.noseRedness;
          out.darkCircles = report.face.darkCircles;
        }
        return out;
      };
      return {
        plain: await read(await variant(1, 1, 1)),
        light: await read(await variant(1.2, 1, 1)),
        dark: await read(await variant(0.8, 1, 1)),
        warm: await read(await variant(1, 1.08, 0.92)),
        cool: await read(await variant(1, 0.92, 1.08)),
      };
    }, b64);
    if (!result.plain) {
      console.log(`${person} ${path.basename(file)}: no face found or unusable photo`);
      continue;
    }
    rows.push({ person, ...result });
    console.log(`${person} ${path.basename(file)}: read`);
  }
  await browser.close();

  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.plain)))];
  const has = (r, v) => r[v] && typeof r[v][key] === "number" && typeof r.plain[key] === "number";
  let key = "";
  const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
  const people = [...new Set(rows.map((r) => r.person))];
  const report = {};
  for (key of keys) {
    const moved = (a, b) =>
      mean(
        rows
          .filter((r) => has(r, a) && has(r, b))
          .map((r) =>
            Math.max(Math.abs(r[a][key] - r.plain[key]), Math.abs(r[b][key] - r.plain[key])),
          ),
      );
    const exposure = moved("light", "dark");
    const colour = moved("warm", "cool");
    const same = Math.max(
      0,
      ...people.map((p) => {
        const v = rows
          .filter((r) => r.person === p)
          .map((r) => r.plain[key])
          .filter((n) => typeof n === "number");
        return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
      }),
    );
    const f = floor(key);
    report[key] = {
      floor: f,
      exposure: +exposure.toFixed(1),
      colour: +colour.toFixed(1),
      same: +same.toFixed(1),
      pass: {
        exposure: exposure <= f,
        colour: colour <= f,
        same: same <= 2 * f,
      },
    };
  }
  console.log(
    JSON.stringify({ people: people.length, photos: rows.length, indicators: report }, null, 2),
  );
})().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
