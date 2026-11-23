// Real-photo gate for a skin texture model (v5 plan, step 4). Runs on this machine only, through
// the app's own face finder, so consented photos never leave it and the test matches what ships.
//
// Needs the dev server on 127.0.0.1:8091 (npx vite dev --host 127.0.0.1 --port 8091).
// Usage: node research/vision/real_photo_gate.cjs <skin-surface_weights_web.json> <person>=<photo>...
//   e.g. node research/vision/real_photo_gate.cjs w.json a=/p/a1.jpg a=/p/a2.jpg b=/p/b1.jpg
// The weights file is export_web.py's output. Photos of the same person share a label.
//
// Checks, each against the spread of readings between different people:
//   blur        a 2 px blur lowers the reading by at least half that spread
//   brightness  +/-20% exposure moves it by at most a fifth of it
//   same person repeat photos of one person differ by at most half of it
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const [weightsPath, ...pairs] = process.argv.slice(2);
if (!weightsPath || pairs.length < 3) {
  console.error("Usage: node real_photo_gate.cjs <weights.json> <person>=<photo> ... (3 or more)");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8091/", { waitUntil: "networkidle" });
  const weights = JSON.parse(fs.readFileSync(weightsPath, "utf8"));
  await page.evaluate(async (weights) => {
    const { createAreaModel } = await import("/src/lib/cv/area-model.ts");
    window.__gate = createAreaModel(weights, "", "texture");
  }, weights);

  const rows = [];
  for (const pair of pairs) {
    const [person, file] = pair.split(/=(.*)/s);
    const b64 = fs.readFileSync(file).toString("base64");
    const r = await page.evaluate(async (b64) => {
      const g = await import("/src/lib/cv/guides.ts");
      const img = new Image();
      img.src = "data:image/jpeg;base64," + b64;
      await img.decode();
      const draw = (filter) => {
        const s = 1280 / Math.max(img.width, img.height);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const x = c.getContext("2d", { willReadFrequently: true });
        x.filter = filter;
        x.drawImage(img, 0, 0, c.width, c.height);
        return x.getImageData(0, 0, c.width, c.height);
      };
      const plain = draw("none");
      const face = await g.findFace(plain);
      if (!face) return null;
      const skin = face.skinAt(plain.width, plain.height);
      // Patches as the app will cut them: scale so the skin is 360 px wide, then every 128 px tile
      // that is at least 60% skin.
      let x0 = plain.width,
        x1 = 0;
      for (let i = 0; i < skin.length; i += 1)
        if (skin[i]) {
          const x = i % plain.width;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      const scale = 360 / Math.max(1, x1 - x0);
      const reading = (data) => {
        const w = Math.round(data.width * scale),
          h = Math.round(data.height * scale);
        const src = document.createElement("canvas");
        src.width = data.width;
        src.height = data.height;
        src.getContext("2d").putImageData(data, 0, 0);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(src, 0, 0, w, h);
        const values = [];
        for (let y = 0; y + 128 <= h; y += 128)
          for (let x = 0; x + 128 <= w; x += 128) {
            const mask = new Uint8Array(128 * 128);
            let on = 0;
            for (let yy = 0; yy < 128; yy += 1)
              for (let xx = 0; xx < 128; xx += 1) {
                const sx = Math.min(data.width - 1, Math.floor((x + xx) / scale));
                const sy = Math.min(data.height - 1, Math.floor((y + yy) / scale));
                if (skin[sy * data.width + sx]) {
                  mask[yy * 128 + xx] = 1;
                  on += 1;
                }
              }
            if (on < 0.6 * 128 * 128 || values.length >= 12) continue;
            const patch = ctx.getImageData(x, y, 128, 128);
            const v = window.__gate.signal(patch, mask);
            if (v !== null) values.push(v);
          }
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      };
      return {
        plain: reading(plain),
        blur: reading(draw("blur(2px)")),
        light: reading(draw("brightness(1.2)")),
        dark: reading(draw("brightness(0.8)")),
      };
    }, b64);
    if (!r || r.plain === null) {
      console.log(`${person} ${path.basename(file)}: no face or no patches`);
      continue;
    }
    rows.push({ person, ...r });
    console.log(`${person} ${path.basename(file)}: ${JSON.stringify(r)}`);
  }
  await browser.close();

  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const people = [...new Set(rows.map((r) => r.person))];
  const personMeans = people.map((p) =>
    mean(rows.filter((r) => r.person === p).map((r) => r.plain)),
  );
  const between = Math.max(...personMeans) - Math.min(...personMeans);
  const within = Math.max(
    0,
    ...people.map((p) => {
      const v = rows.filter((r) => r.person === p).map((r) => r.plain);
      return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
    }),
  );
  const spread = Math.max(between, 1e-6);
  const blur = mean(rows.map((r) => r.blur - r.plain)) / spread;
  const bright =
    mean(rows.map((r) => Math.max(Math.abs(r.light - r.plain), Math.abs(r.dark - r.plain)))) /
    spread;
  const checks = {
    blur: { value: +blur.toFixed(3), pass: blur <= -0.5 },
    brightness: { value: +bright.toFixed(3), pass: bright <= 0.2 },
    samePerson: { value: +(within / spread).toFixed(3), pass: within / spread <= 0.5 },
  };
  console.log(JSON.stringify({ people: people.length, photos: rows.length, checks }, null, 2));
  console.log(Object.values(checks).every((c) => c.pass) ? "GATE: PASS" : "GATE: FAIL");
})().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
