"""Glowtrace vision: one physics-supervised model per area (skin, hair, nails), every indicator.

Nobody labels "how much redness, shine, ridging or yellowing" a photo has, so the labels come from
physics and optics. Real base photos get known amounts of each effect added, per pixel:

  skin   redness   haemoglobin absorption (Beer-Lambert, OD direction R:G:B 0.04 : 1 : 0.85)
         pigment   melanin absorption in patches (OD 0.45 : 0.75 : 1), freckle- to patch-sized
         shine     surface (specular) reflection: adds the light's own colour (dichromatic model)
         texture   fine bumps: high-frequency shading of brightness, like pores and roughness
  nails  yellowing stain absorbing blue most (OD 0.05 : 0.25 : 1)
         spots     small white spots blended in (leukonychia-like)
         ridges    lengthwise shading ripple along the nail
  hair   shine     elongated highlight bands
         texture   fine high-frequency roughness

Each training example is two views of one base photo, each under its own random light colour,
exposure, blur and sensor noise; view B also gets a random mix of the effects. A small U-Net
with one output map per indicator must predict, at every pixel, how much of each effect B has
over A. So it learns to separate the effects from each other and from light and camera. For skin
a fairness term keeps the average output equal across Monk skin-tone groups.

Skin base photos: Google SCIN (SCIN Data Use License, no re-identification). Hair and nail base
photos: a folder of licensed images (--images DIR), see research/vision/README.md.

Usage:
  python3 multitask.py skin [--quick]
  python3 multitask.py nails --images DIR [--quick]
  python3 multitask.py hair --images DIR [--quick]
Writes <area>_model.onnx, <area>_weights.json and <area>_eval.json in the current folder.
"""
import csv
import glob
import io
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

AREA = sys.argv[1] if len(sys.argv) > 1 else "skin"
QUICK = "--quick" in sys.argv
IMAGES_DIR = sys.argv[sys.argv.index("--images") + 1] if "--images" in sys.argv else None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SIZE = 128
EPOCHS = 2 if QUICK else 80
STEPS = 4 if QUICK else 50
WORK = os.environ.get("GLOWTRACE_WORK", "glowtrace_work")

HEADS = {
    "skin": ["redness", "pigment", "shine", "texture"],
    "nails": ["yellowing", "spots", "ridges"],
    "hair": ["shine", "texture"],
}[AREA]

HAEMOGLOBIN = torch.tensor([0.04, 1.0, 0.85])
MELANIN = torch.tensor([0.45, 0.75, 1.0])
STAIN = torch.tensor([0.05, 0.25, 1.0])

# ---------------------------------------------------------------- base photos

BUCKET = "https://storage.googleapis.com/dx-scin-public-data/"
GROUPS = {0: [1, 2], 1: [3, 4], 2: [5, 6], 3: [7, 8, 9, 10]}


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def to_canvas(image):
    image.thumbnail((SIZE, SIZE), Image.BILINEAR)
    canvas = np.zeros((SIZE, SIZE, 3), np.uint8)
    valid = np.zeros((SIZE, SIZE), np.uint8)
    array = np.asarray(image.convert("RGB"))
    canvas[: array.shape[0], : array.shape[1]] = array
    valid[: array.shape[0], : array.shape[1]] = 1
    return canvas, valid


def load_scin(per_group):
    os.makedirs(WORK, exist_ok=True)
    cache = os.path.join(WORK, f"scin_{per_group}.npz")
    if os.path.exists(cache):
        d = np.load(cache)
        return d["image"], d["valid"], d["group"]
    cases = {r["case_id"]: r for r in csv.DictReader(io.StringIO(fetch(BUCKET + "dataset/scin_cases.csv").decode()))}
    labels = list(csv.DictReader(io.StringIO(fetch(BUCKET + "dataset/scin_labels.csv").decode())))
    picks = []
    for group, tones in GROUPS.items():
        rows = []
        for label in labels:
            try:
                tone = int(label["monk_skin_tone_label_us"])
            except ValueError:
                continue
            case = cases.get(label["case_id"])
            if tone in tones and case and case["image_1_shot_type"] == "CLOSE_UP" and case["image_1_path"]:
                rows.append((label["case_id"], case["image_1_path"], group))
        rows.sort()
        picks += rows[:per_group]

    def one(item):
        try:
            canvas, valid = to_canvas(Image.open(io.BytesIO(fetch(BUCKET + item[1]))))
            return canvas, valid, item[2]
        except Exception:
            return None

    with ThreadPoolExecutor(8) as pool:
        loaded = [x for x in pool.map(one, picks) if x is not None]
    out = (np.stack([x[0] for x in loaded]), np.stack([x[1] for x in loaded]), np.array([x[2] for x in loaded]))
    np.savez_compressed(cache, image=out[0], valid=out[1], group=out[2])
    return out


def load_folder(folder, limit):
    paths = sorted(glob.glob(os.path.join(folder, "**", "*.*"), recursive=True))
    paths = [p for p in paths if p.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))][:limit]
    loaded = []
    for path in paths:
        try:
            loaded.append(to_canvas(Image.open(path)))
        except Exception:
            continue
    if not loaded:
        raise SystemExit(f"No images found in {folder}")
    images = np.stack([x[0] for x in loaded])
    valid = np.stack([x[1] for x in loaded])
    return images, valid, np.zeros(len(loaded), dtype=int)


# ---------------------------------------------------------------- colour and masks


def lab(rgb):
    c = rgb / 255.0
    lin = torch.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = lin[:, 0], lin[:, 1], lin[:, 2]
    x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
    y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
    z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883
    f = lambda t: torch.where(t > 216 / 24389, torch.pow(t.clamp(min=1e-9), 1 / 3), (841 / 108) * t + 4 / 29)
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def area_mask(rgb, valid):
    """Skin: skin-coloured pixels (the app's rule). Hair and nails: the whole valid photo."""
    if AREA != "skin":
        return (valid > 0).float()
    L, a, b = lab(rgb)
    hue = torch.rad2deg(torch.atan2(b, a))
    skin = (L > 20) & (L < 95) & (a > 2) & (hue > 10) & (hue < 80) & (valid > 0)
    fallback = (skin.flatten(1).float().mean(1) < 0.1)[:, None, None]
    return torch.where(fallback, valid > 0, skin).float()


def od(rgb):
    return -torch.log((rgb + 0.5) / 255.5)


def from_od(density):
    return 255.5 * torch.exp(-density) - 0.5


def network_input(rgb, mask):
    return torch.cat([od(rgb) / 3.0, mask[:, None]], 1)


# ---------------------------------------------------------------- effect generators (per-pixel weights)


def rand(shape, gen, lo=0.0, hi=1.0):
    return lo + (hi - lo) * torch.rand(shape, device=DEVICE, generator=gen)


def grid(n):
    yy = torch.arange(SIZE, device=DEVICE).view(1, SIZE, 1).float()
    xx = torch.arange(SIZE, device=DEVICE).view(1, 1, SIZE).float()
    return yy, xx


def blobs(n, gen, count, small, large):
    """Sum of `count` soft round blobs per image, each 0-1."""
    yy, xx = grid(n)
    out = torch.zeros(n, SIZE, SIZE, device=DEVICE)
    for _ in range(count):
        cy, cx = rand((n, 1, 1), gen, 0, SIZE), rand((n, 1, 1), gen, 0, SIZE)
        sigma = rand((n, 1, 1), gen, small, large)
        out = torch.maximum(out, torch.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * sigma**2)))
    return out


def streaks(n, gen, count, length, width):
    """Elongated highlight bands at a random angle per image (hair shine)."""
    yy, xx = grid(n)
    angle = rand((n, 1, 1), gen, 0, np.pi)
    u = xx * torch.cos(angle) + yy * torch.sin(angle)
    v = -xx * torch.sin(angle) + yy * torch.cos(angle)
    out = torch.zeros(n, SIZE, SIZE, device=DEVICE)
    for _ in range(count):
        cu, cv = rand((n, 1, 1), gen, -SIZE, 2 * SIZE), rand((n, 1, 1), gen, -SIZE, 2 * SIZE)
        band = torch.exp(-((u - cu) ** 2) / (2 * length**2) - ((v - cv) ** 2) / (2 * width**2))
        out = torch.maximum(out, band)
    return out


def fine_noise(n, gen):
    """Band-limited high-frequency field in -1..1 (pores, bumps, fibres)."""
    noise = torch.randn(n, 1, SIZE, SIZE, device=DEVICE, generator=gen)
    smooth = F.avg_pool2d(F.pad(noise, (1, 1, 1, 1), mode="reflect"), 3, 1)
    coarse = F.avg_pool2d(F.pad(noise, (3, 3, 3, 3), mode="reflect"), 7, 1)
    field = (smooth - coarse)[:, 0]
    return field / field.flatten(1).std(1).clamp(min=1e-6)[:, None, None]


def ripple(n, gen):
    """Lengthwise ridges: a sinusoid across the nail at a random angle and spacing."""
    yy, xx = grid(n)
    angle = rand((n, 1, 1), gen, -0.3, 0.3) + np.pi / 2
    period = rand((n, 1, 1), gen, 3, 8)
    u = xx * torch.cos(angle) + yy * torch.sin(angle)
    return torch.sin(2 * np.pi * u / period)


def add_effects(rgb, mask, gen):
    """Adds a random mix of this area's effects. Returns the new photo and the per-head maps."""
    n = rgb.shape[0]
    maps = {}
    density = od(rgb)
    light = 255 * torch.ones(n, 3, 1, 1, device=DEVICE)  # specular adds the light's colour
    img_od = density.clone()

    def amount(lo, hi, p_zero=0.3):
        a = rand((n, 1, 1), gen, lo, hi)
        a[torch.rand(n, device=DEVICE, generator=gen) < p_zero] = 0
        return a

    if AREA == "skin":
        hb = amount(-0.08, 0.25) * torch.where(rand((n, 1, 1), gen) < 0.5, torch.ones(n, SIZE, SIZE, device=DEVICE), blobs(n, gen, 1, 15, 60)) * mask
        mel = amount(0.0, 0.35) * blobs(n, gen, 6, 2, 12) * mask
        img_od = img_od + hb[:, None] * HAEMOGLOBIN.to(DEVICE)[None, :, None, None] + mel[:, None] * MELANIN.to(DEVICE)[None, :, None, None]
        maps["redness"], maps["pigment"] = hb, mel
        img = from_od(img_od)
        rough = amount(0.0, 0.12) * mask
        img = img * (1 + rough[:, None] * fine_noise(n, gen)[:, None])
        maps["texture"] = rough
        spec = amount(0.0, 0.35) * blobs(n, gen, 3, 4, 20) * mask
        img = img + spec[:, None] * light
        maps["shine"] = spec
    elif AREA == "nails":
        stain = amount(0.0, 0.5) * mask
        img = from_od(img_od + stain[:, None] * STAIN.to(DEVICE)[None, :, None, None])
        spots = amount(0.0, 0.8) * blobs(n, gen, 4, 1.5, 4) * mask
        img = img * (1 - spots[:, None]) + 245 * spots[:, None]
        ridge = amount(0.0, 0.08) * mask
        img = img * (1 + ridge[:, None] * ripple(n, gen)[:, None])
        maps["yellowing"], maps["spots"], maps["ridges"] = stain, spots, ridge
    else:
        img = from_od(img_od)
        rough = amount(0.0, 0.15) * mask
        img = img * (1 + rough[:, None] * fine_noise(n, gen)[:, None])
        spec = amount(0.0, 0.4) * streaks(n, gen, 3, 40, 3) * mask
        img = img + spec[:, None] * light
        maps["shine"], maps["texture"] = spec, rough
    return img, torch.stack([maps[h] for h in HEADS], 1)


def camera(rgb, gen):
    """Random light colour, exposure, blur and sensor noise."""
    n = rgb.shape[0]
    gains = torch.exp(0.07 * torch.randn(n, 3, 1, 1, device=DEVICE, generator=gen))
    gains = gains * torch.exp(0.15 * torch.randn(n, 1, 1, 1, device=DEVICE, generator=gen))
    img = rgb * gains
    blur = torch.rand(n, device=DEVICE, generator=gen) < 0.4
    if blur.any():
        img[blur] = F.avg_pool2d(F.pad(img[blur], (1, 1, 1, 1), mode="replicate"), 3, 1)
    sigma = rand((n, 1, 1, 1), gen, 0.5, 3.0)
    return (img + torch.randn(img.shape, device=DEVICE, generator=gen) * sigma).clamp(0, 255).round()


def make_batch(images, valid, gen):
    mask = area_mask(images, valid)
    with_effects, targets = add_effects(images, mask, gen)
    a, b = camera(images, gen), camera(with_effects, gen)
    return network_input(a, area_mask(a, valid)), network_input(b, area_mask(b, valid)), targets, mask


# ---------------------------------------------------------------- model


class UNet(nn.Module):
    def __init__(self, heads):
        super().__init__()
        conv = lambda i, o, s=1: nn.Sequential(nn.Conv2d(i, o, 3, s, 1), nn.ReLU())
        self.e1, self.e2, self.e3 = conv(4, 16), conv(16, 32, 2), conv(32, 48, 2)
        self.mid = conv(48, 48)
        self.d2, self.d1 = conv(80, 32), conv(48, 16)
        self.out = nn.Conv2d(16, heads, 1)

    def forward(self, x):
        s1 = self.e1(x)
        s2 = self.e2(s1)
        s3 = self.mid(self.e3(s2))
        u2 = self.d2(torch.cat([F.interpolate(s3, size=s2.shape[-2:], mode="nearest"), s2], 1))
        u1 = self.d1(torch.cat([F.interpolate(u2, size=s1.shape[-2:], mode="nearest"), s1], 1))
        return self.out(u1)


def masked_mean(values, mask):
    return (values * mask[:, None]).flatten(2).sum(2) / mask.flatten(1).sum(1).clamp(min=1)[:, None]


# ---------------------------------------------------------------- train and evaluate


def main():
    torch.manual_seed(0)
    if AREA == "skin":
        images_np, valid_np, groups_np = load_scin(40 if QUICK else 150)
    else:
        if not IMAGES_DIR:
            raise SystemExit("Hair and nails need --images DIR (see research/vision/README.md)")
        images_np, valid_np, groups_np = load_folder(IMAGES_DIR, 200 if QUICK else 5000)
    order = np.random.default_rng(0).permutation(len(images_np))
    split = int(0.8 * len(order))
    train_ids, test_ids = order[:split], order[split:]
    images = torch.tensor(images_np, dtype=torch.float32).permute(0, 3, 1, 2).to(DEVICE)
    valid = torch.tensor(valid_np, dtype=torch.float32).to(DEVICE)
    groups = torch.tensor(groups_np).to(DEVICE)
    model = UNet(len(HEADS)).to(DEVICE)
    print(f"{AREA}: {len(images_np)} photos, heads {HEADS}, {sum(p.numel() for p in model.parameters())} parameters, {DEVICE}")
    optimiser = torch.optim.Adam(model.parameters(), lr=2e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, EPOCHS * STEPS)
    gen = torch.Generator(device=DEVICE).manual_seed(1)
    train_t = torch.tensor(train_ids, device=DEVICE)
    scale = 10.0
    for epoch in range(EPOCHS):
        total = 0.0
        for _ in range(STEPS):
            idx = train_t[torch.randint(len(train_t), (32,), device=DEVICE, generator=gen)]
            if AREA == "skin":
                deep = train_t[groups[train_t] == 3]
                idx = torch.cat([idx, deep[torch.randint(len(deep), (8,), device=DEVICE, generator=gen)]])
            xa, xb, targets, mask = make_batch(images[idx], valid[idx], gen)
            diff = model(xb) - model(xa)
            loss = (((diff - targets * scale) ** 2) * mask[:, None]).flatten(2).sum(2).div(mask.flatten(1).sum(1).clamp(min=1)[:, None]).mean()
            if AREA == "skin":
                sample = train_t[torch.randint(len(train_t), (64,), device=DEVICE, generator=gen)]
                m = area_mask(images[sample], valid[sample])
                level = masked_mean(model(network_input(images[sample], m)), m)
                g = groups[sample]
                means = torch.stack([level[g == k].mean(0) for k in range(4) if (g == k).any()])
                loss = loss + 2.0 * ((means - means.mean(0)) ** 2).mean()
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            scheduler.step()
            total += loss.item()
        print(f"epoch {epoch + 1}/{EPOCHS} loss {total / STEPS:.4f}", flush=True)

    model.eval()
    report = {"area": AREA, "heads": {}}
    with torch.no_grad():
        egen = torch.Generator(device=DEVICE).manual_seed(99)
        reps = torch.tensor(test_ids, device=DEVICE).repeat_interleave(8)
        diffs, truths = [], []
        for start in range(0, len(reps), 64):
            idx = reps[start : start + 64]
            xa, xb, targets, mask = make_batch(images[idx], valid[idx], egen)
            diffs.append(masked_mean(model(xb) - model(xa), mask))
            truths.append(masked_mean(targets, mask))
        diff, truth = torch.cat(diffs).cpu().numpy(), torch.cat(truths).cpu().numpy()
        for k, head in enumerate(HEADS):
            d, t = diff[:, k], truth[:, k]
            slope = float(np.polyfit(t, d, 1)[0]) if t.std() > 0 else float("nan")
            # How much this head reacts to the other effects and to light alone (lower is better).
            others = np.abs(np.delete(truth, k, axis=1)).sum(1) > 0
            alone = (t == 0)
            report["heads"][head] = {
                "corr_with_true_amount": round(float(np.corrcoef(d, t)[0, 1]), 3),
                "noise_when_absent_in_own_units": round(float(np.std(d[alone]) / abs(slope)), 4) if alone.any() else None,
                "leak_from_other_effects": round(float(np.corrcoef(d[alone & others], truth[alone & others].sum(1))[0, 1]), 3) if (alone & others).sum() > 2 else None,
            }
    print(json.dumps(report, indent=2))
    json.dump(report, open(f"{AREA}_eval.json", "w"), indent=2)
    model.cpu()
    torch.onnx.export(model, torch.zeros(1, 4, SIZE, SIZE), f"{AREA}_model.onnx", input_names=["input"], output_names=["maps"], opset_version=17, dynamo=False)
    weights = {name: t.detach().numpy().round(6).tolist() for name, t in model.state_dict().items()}
    json.dump({"area": AREA, "heads": HEADS, "size": SIZE, "weights": weights, "evaluation": report}, open(f"{AREA}_weights.json", "w"))
    print(f"Wrote {AREA}_model.onnx, {AREA}_weights.json, {AREA}_eval.json")


if __name__ == "__main__":
    main()
