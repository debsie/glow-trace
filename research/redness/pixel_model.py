"""Pixel-level, physics-supervised redness model (U-Net) for Glowtrace.

Same idea as model.py, but the network reads every pixel and outputs a redness map. Training
pairs are two views of one real SCIN skin photo under independent random light, exposure, blur
and noise; one view has a known amount of haemoglobin added per pixel (Beer-Lambert). The map's
difference between the views must equal the added amount at every skin pixel, so the network
learns where blood colour is, not just how much. A fairness term keeps the average output equal
across Monk skin-tone groups on unaltered photos.

Runs on a GPU (Colab, Kaggle) in about 20-40 minutes, or on CPU slowly. Writes:
  redness_pixel.onnx         the model (input 1x4x128x128: OD r,g,b + skin mask; output 1x1x128x128)
  redness_pixel_weights.json the same weights as plain arrays, for a dependency-free runtime
  redness_pixel_eval.json    held-out results, to compare with the shipped model

Usage: python3 pixel_model.py [--quick]
"""
import csv
import io
import json
import math
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

QUICK = "--quick" in sys.argv
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SIZE = 128
PER_GROUP = 40 if QUICK else 150
EPOCHS = 2 if QUICK else 60
BUCKET = "https://storage.googleapis.com/dx-scin-public-data/"
GROUPS = {0: [1, 2], 1: [3, 4], 2: [5, 6], 3: [7, 8, 9, 10]}
HB = torch.tensor([0.04, 1.0, 0.85])  # haemoglobin OD direction (R, G, B), jittered per example
WORK = os.environ.get("GLOWTRACE_WORK", "scin_work")

# ---------------------------------------------------------------- data (SCIN, licence: no re-identification)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def load_sample():
    os.makedirs(WORK, exist_ok=True)
    cache = os.path.join(WORK, f"sample_{PER_GROUP}.npz")
    if os.path.exists(cache):
        data = np.load(cache)
        return data["image"], data["valid"], data["group"]
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
        picks += rows[:PER_GROUP]

    def one(item):
        _, path, group = item
        try:
            image = Image.open(io.BytesIO(fetch(BUCKET + path))).convert("RGB")
        except Exception:
            return None
        image.thumbnail((SIZE, SIZE), Image.BILINEAR)
        canvas = np.zeros((SIZE, SIZE, 3), np.uint8)
        valid = np.zeros((SIZE, SIZE), np.uint8)
        array = np.asarray(image)
        canvas[: array.shape[0], : array.shape[1]] = array
        valid[: array.shape[0], : array.shape[1]] = 1
        return canvas, valid, group

    with ThreadPoolExecutor(8) as pool:
        loaded = [x for x in pool.map(one, picks) if x is not None]
    image = np.stack([x[0] for x in loaded])
    valid = np.stack([x[1] for x in loaded])
    group = np.array([x[2] for x in loaded])
    np.savez_compressed(cache, image=image, valid=valid, group=group)
    return image, valid, group


# ---------------------------------------------------------------- colour helpers (torch, batched)


def srgb_to_lab(rgb):
    """rgb: B x 3 x H x W in 0-255. Returns L, a, b (B x H x W). Same maths as the app."""
    c = rgb / 255.0
    lin = torch.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = lin[:, 0], lin[:, 1], lin[:, 2]
    x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
    y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
    z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883
    f = lambda t: torch.where(t > 216 / 24389, torch.pow(t.clamp(min=1e-9), 1 / 3), (841 / 108) * t + 4 / 29)
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def skin_mask(rgb, valid):
    L, a, b = srgb_to_lab(rgb)
    hue = torch.rad2deg(torch.atan2(b, a))
    skin = (L > 20) & (L < 95) & (a > 2) & (hue > 10) & (hue < 80) & (valid > 0)
    share = skin.flatten(1).float().mean(1)
    # Too little skin colour: use the whole (valid) photo, as the app does.
    fallback = (share < 0.1)[:, None, None]
    return torch.where(fallback, valid > 0, skin).float()


def to_od(rgb):
    return -torch.log((rgb + 0.5) / 255.5)


def from_od(od):
    return 255.5 * torch.exp(-od) - 0.5


def network_input(rgb, mask):
    """What the app feeds the model: OD of the photo (scaled) and the skin mask."""
    return torch.cat([to_od(rgb) / 3.0, mask[:, None]], dim=1)


# ---------------------------------------------------------------- physics simulator


def blood_map(mask, gen):
    """Per-pixel weight of added blood: all skin, or a soft blob over part of it."""
    n, h, w = mask.shape
    yy = torch.arange(h, device=mask.device).view(1, h, 1).float()
    xx = torch.arange(w, device=mask.device).view(1, 1, w).float()
    cy = torch.rand(n, 1, 1, device=mask.device, generator=gen) * h
    cx = torch.rand(n, 1, 1, device=mask.device, generator=gen) * w
    sigma = (0.15 + 0.35 * torch.rand(n, 1, 1, device=mask.device, generator=gen)) * max(h, w)
    blob = torch.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * sigma**2))
    whole = torch.rand(n, 1, 1, device=mask.device, generator=gen) < 0.5
    return mask * torch.where(whole, torch.ones_like(blob), blob)


def render(rgb, add, gen):
    """add: B x H x W haemoglobin per pixel. Then random light colour, exposure, blur, noise."""
    n = rgb.shape[0]
    dev = rgb.device
    hb = HB.to(dev)[None, :, None, None] * (0.8 + 0.4 * torch.rand(n, 3, 1, 1, device=dev, generator=gen))
    hb = hb / hb[:, 1:2]
    img = from_od(to_od(rgb) + add[:, None] * hb)
    gains = torch.exp(0.07 * torch.randn(n, 3, 1, 1, device=dev, generator=gen))
    gains = gains * torch.exp(0.15 * torch.randn(n, 1, 1, 1, device=dev, generator=gen))
    img = img * gains
    blur = torch.rand(n, device=dev, generator=gen) < 0.4
    if blur.any():
        img[blur] = F.avg_pool2d(F.pad(img[blur], (1, 1, 1, 1), mode="replicate"), 3, stride=1)
    img = img + torch.randn(img.shape, device=dev, generator=gen) * (0.5 + 2.5 * torch.rand(n, 1, 1, 1, device=dev, generator=gen))
    return img.clamp(0, 255).round()


def make_batch(images, valid, gen):
    """Returns inputs for views A and B, the true added-blood map, and the skin mask."""
    n = images.shape[0]
    dev = images.device
    base_mask = skin_mask(images, valid)
    amount = torch.empty(n, 1, 1, device=dev).uniform_(-0.08, 0.25, generator=gen)
    amount[torch.rand(n, device=dev, generator=gen) < 0.25] = 0.0
    target = amount * blood_map(base_mask, gen)
    a = render(images, torch.zeros_like(target), gen)
    b = render(images, target, gen)
    # The model sees each view's own skin mask, as it would in the app.
    xa = network_input(a, skin_mask(a, valid))
    xb = network_input(b, skin_mask(b, valid))
    return xa, xb, target, base_mask


# ---------------------------------------------------------------- model


class TinyUNet(nn.Module):
    """About 60k parameters: small enough to run in the browser without a runtime library."""

    def __init__(self):
        super().__init__()
        conv = lambda i, o, s=1: nn.Sequential(nn.Conv2d(i, o, 3, s, 1), nn.ReLU())
        self.e1 = conv(4, 16)
        self.e2 = conv(16, 32, 2)
        self.e3 = conv(32, 48, 2)
        self.mid = conv(48, 48)
        self.d2 = conv(48 + 32, 32)
        self.d1 = conv(32 + 16, 16)
        self.out = nn.Conv2d(16, 1, 1)

    def forward(self, x):
        s1 = self.e1(x)
        s2 = self.e2(s1)
        s3 = self.mid(self.e3(s2))
        u2 = self.d2(torch.cat([F.interpolate(s3, size=s2.shape[-2:], mode="nearest"), s2], 1))
        u1 = self.d1(torch.cat([F.interpolate(u2, size=s1.shape[-2:], mode="nearest"), s1], 1))
        return self.out(u1)[:, 0]


def masked_mean(values, mask):
    return (values * mask).flatten(1).sum(1) / mask.flatten(1).sum(1).clamp(min=1)


# ---------------------------------------------------------------- training and evaluation


def main():
    torch.manual_seed(0)
    images_np, valid_np, groups_np = load_sample()
    order = np.random.default_rng(0).permutation(len(images_np))
    split = int(0.8 * len(order))
    train_ids, test_ids = order[:split], order[split:]
    images = torch.tensor(images_np, dtype=torch.float32).permute(0, 3, 1, 2).to(DEVICE)
    valid = torch.tensor(valid_np, dtype=torch.float32).to(DEVICE)
    groups = torch.tensor(groups_np).to(DEVICE)
    print(f"{len(images_np)} photos, device {DEVICE}, epochs {EPOCHS}")

    model = TinyUNet().to(DEVICE)
    print(sum(p.numel() for p in model.parameters()), "parameters")
    optimiser = torch.optim.Adam(model.parameters(), lr=2e-3)
    gen = torch.Generator(device=DEVICE).manual_seed(1)
    train_t = torch.tensor(train_ids, device=DEVICE)
    steps_per_epoch = 40 if not QUICK else 4
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, EPOCHS * steps_per_epoch)
    for epoch in range(EPOCHS):
        total = 0.0
        for _ in range(steps_per_epoch):
            idx = train_t[torch.randint(len(train_t), (32,), device=DEVICE, generator=gen)]
            # Deeper tones (group 3) are rarer: draw them twice as often.
            deep = train_t[groups[train_t] == 3]
            idx = torch.cat([idx, deep[torch.randint(len(deep), (8,), device=DEVICE, generator=gen)]])
            xa, xb, target, mask = make_batch(images[idx], valid[idx], gen)
            diff = model(xb) - model(xa)
            loss = masked_mean((diff - target * 10) ** 2, mask).mean()
            # Fairness: equal average output per skin-tone group on unaltered photos.
            sample = train_t[torch.randint(len(train_t), (64,), device=DEVICE, generator=gen)]
            orig_mask = skin_mask(images[sample], valid[sample])
            level = masked_mean(model(network_input(images[sample], orig_mask)), orig_mask)
            g = groups[sample]
            means = torch.stack([level[g == k].mean() for k in range(4) if (g == k).any()])
            loss = loss + 2.0 * ((means - means.mean()) ** 2).mean()
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            scheduler.step()
            total += loss.item()
        print(f"epoch {epoch + 1}/{EPOCHS} loss {total / steps_per_epoch:.4f}", flush=True)

    model.eval()
    with torch.no_grad():
        egen = torch.Generator(device=DEVICE).manual_seed(99)
        test_t = torch.tensor(test_ids, device=DEVICE)
        reps = test_t.repeat_interleave(8)
        diffs, truths, pair_groups = [], [], []
        for start in range(0, len(reps), 64):
            idx = reps[start : start + 64]
            xa, xb, target, mask = make_batch(images[idx], valid[idx], egen)
            diffs.append(masked_mean(model(xb) - model(xa), mask))
            truths.append(masked_mean(target, mask))
            pair_groups.append(groups[idx])
        diff = torch.cat(diffs).cpu().numpy()
        truth = torch.cat(truths).cpu().numpy()
        pg = torch.cat(pair_groups).cpu().numpy()
        slope = float(np.polyfit(truth, diff, 1)[0])
        zero = truth == 0
        orig_mask = skin_mask(images[test_t], valid[test_t])
        level = masked_mean(model(network_input(images[test_t], orig_mask)), orig_mask).cpu().numpy()
        q25, q75 = np.percentile(level, [25, 75])
        tg = groups_np[test_ids]
        medians = [float(np.median(level[tg == k])) for k in range(4)]
        report = {
            "corr_with_true_change": round(float(np.corrcoef(diff, truth)[0, 1]), 3),
            "light_noise_in_hb_units": round(float(np.std(diff[zero]) / abs(slope)), 4),
            "light_noise_by_tone": [round(float(np.std(diff[zero & (pg == k)]) / abs(slope)), 4) for k in range(4)],
            "tone_spread_over_iqr": round((max(medians) - min(medians)) / float(q75 - q25), 3),
            "shipped_model_for_comparison": {"corr": 0.644, "light_noise": 0.0877, "tone_spread": 0.297},
        }
    print(json.dumps(report, indent=2))
    json.dump(report, open("redness_pixel_eval.json", "w"), indent=2)

    model.cpu()
    torch.onnx.export(
        model,
        torch.zeros(1, 4, SIZE, SIZE),
        "redness_pixel.onnx",
        input_names=["input"],
        output_names=["map"],
        opset_version=17,
        dynamo=False,
    )
    weights = {name: tensor.detach().numpy().round(6).tolist() for name, tensor in model.state_dict().items()}
    json.dump({"architecture": "TinyUNet v1", "size": SIZE, "weights": weights, "evaluation": report}, open("redness_pixel_weights.json", "w"))
    print("Wrote redness_pixel.onnx, redness_pixel_weights.json, redness_pixel_eval.json")


if __name__ == "__main__":
    main()
