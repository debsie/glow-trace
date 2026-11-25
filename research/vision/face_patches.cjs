// Usage (dev server on 127.0.0.1:8091): node research/vision/face_patches.cjs <out_dir> <face.jpg>...
// Built for the FairFace redness round (round 3); see research/vision/README.md.
// One skin patch per FairFace face: the 56 px square with the most face-guide skin (>= 95%),
// enlarged to 128 px for the labelling page (redness is colour, so enlarging loses nothing).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const [out, ...files] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:8091/", { waitUntil: "networkidle" });
  let ok = 0;
  for (const f of files) {
    const b64 = fs.readFileSync(f).toString("base64");
    const r = await p.evaluate(async (b64) => {
      const g = await import("/src/lib/cv/guides.ts");
      const im = await import("/src/lib/cv/image.ts");
      const blob = await (await fetch("data:image/jpeg;base64," + b64)).blob();
      const img = await im.loadImageData(blob, 448);
      const face = await g.findFace(img);
      if (!face) return null;
      const m = face.skinAt(img.width, img.height);
      if (!m) return null;
      const W = img.width,
        H = img.height,
        S = Math.round(W * 0.2),
        PAD = Math.round(W * 0.04);
      const I = new Int32Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          I[(y + 1) * (W + 1) + x + 1] =
            m[y * W + x] + I[y * (W + 1) + x + 1] + I[(y + 1) * (W + 1) + x] - I[y * (W + 1) + x];
      let best = 0,
        bx = 0,
        by = 0,
        T = 0;
      // Score the square with a margin around it, so it sits well inside the skin.
      T = S + 2 * PAD;
      for (let y = 0; y + T <= H; y += 2)
        for (let x = 0; x + T <= W; x += 2) {
          const s =
            I[(y + T) * (W + 1) + x + T] -
            I[y * (W + 1) + x + T] -
            I[(y + T) * (W + 1) + x] +
            I[y * (W + 1) + x];
          if (s > best) {
            best = s;
            bx = x;
            by = y;
          }
        }
      if (best < 0.98 * T * T) return null;
      bx += PAD;
      by += PAD;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.getContext("2d").putImageData(img, 0, 0);
      const o = document.createElement("canvas");
      o.width = 128;
      o.height = 128;
      const x = o.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(c, bx, by, S, S, 0, 0, 128, 128);
      return o.toDataURL("image/png").split(",")[1];
    }, b64);
    if (!r) continue;
    fs.writeFileSync(path.join(out, path.basename(f, ".jpg") + ".png"), Buffer.from(r, "base64"));
    ok++;
  }
  console.log(`patches ${ok} of ${files.length}`);
  await b.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
