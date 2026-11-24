"""Builds the skin-smoothness labelling page (v6 plan, step 6) and the patch file training needs.

Debbie compares two close-up skin patches at a time and taps the smoother one. The page is one
self-contained HTML file: no internet, no account, answers saved on the device after every tap and
downloaded as a JSON file at the end. Nothing is uploaded anywhere.

Usage:
  python3 research/vision/make_label_page.py <patches.npz> <out_dir> [--pairs 300] [--lift]
  python3 research/vision/make_label_page.py --from-folder <png_dir> <patches.npz>

--from-folder turns a folder of 128 px PNG patches (cut by the app's own face guide and
skinPatches, see research/vision/README.md) into a patches file, with each patch's skin-tone band
from its ITA. --lift shows dark patches brighter on the page (display only: the stored pixels and
the answers stay with the originals), because deep skin is harder to judge on a phone screen.

<patches.npz> holds `image` (N x 128 x 128 x 3 uint8) and `group` (skin-tone band 0-3): the
`--patches` SCIN cache multitask.py writes (scin_<n>_128_patches.npz). Writes:
  <out_dir>/glowtrace_labelling.html   send this to the person labelling
  <out_dir>/label_patches.npz          the exact pixels shown, for training (keep with the answers)

The page and the patch file share a set id (a hash of the pixels), and training refuses answers
whose set id does not match, so labels can never be joined to the wrong patches.
Patch pixels come from SCIN (no re-identification) and are never committed to the repo.
"""
import base64
import hashlib
import io
import json
import os
import sys

import numpy as np
from PIL import Image

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "label_page_template.html")
REPEAT_SHARE = 0.1  # pairs shown twice, swapped, to measure consistency
SAME_BAND_SHARE = 0.8  # most pairs within one skin-tone band, some across


def pick_pairs(groups, count, seed=0):
    rng = np.random.default_rng(seed)
    n = len(groups)
    unique = count - int(round(count * REPEAT_SHARE))
    seen, pairs = set(), []
    by_band = {b: np.flatnonzero(groups == b) for b in np.unique(groups)}
    uses = np.zeros(n, int)
    tries = 0
    while len(pairs) < unique and tries < unique * 200:
        tries += 1
        if rng.random() < SAME_BAND_SHARE:
            band = rng.choice(list(by_band))
            pool = by_band[band]
        else:
            pool = np.arange(n)
        if len(pool) < 2:
            continue
        # Prefer patches used least so far, so every patch gets compared.
        weights = 1.0 / (1 + uses[pool])
        a, b = rng.choice(pool, 2, replace=False, p=weights / weights.sum())
        key = (min(a, b), max(a, b))
        if key in seen:
            continue
        seen.add(key)
        uses[a] += 1
        uses[b] += 1
        pairs.append([int(a), int(b)])
    if len(pairs) < unique:
        raise SystemExit(f"Only {len(pairs)} distinct pairs possible; use more patches or fewer pairs")
    repeats = [[b, a] for a, b in rng.choice(np.array(pairs), count - unique, replace=False).tolist()]
    order = pairs + repeats
    rng.shuffle(order)
    # Keep repeats away from their original so they are not obvious.
    return [[int(a), int(b)] for a, b in order]


def ita_band(image):
    """Skin-tone band 0-3 (lighter to deep) from the median ITA of skin-coloured pixels."""
    rgb = image.reshape(-1, 3).astype(np.float64) / 255.0
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    x = (lin @ np.array([0.4124564, 0.3575761, 0.1804375])) / 0.95047
    y = lin @ np.array([0.2126729, 0.7151522, 0.072175])
    z = (lin @ np.array([0.0193339, 0.119192, 0.9503041])) / 1.08883
    f = lambda t: np.where(t > 216 / 24389, np.cbrt(np.maximum(t, 1e-9)), (841 / 108) * t + 4 / 29)
    L, b = 116 * f(y) - 16, 200 * (f(y) - f(z))
    ita = np.degrees(np.arctan((np.median(L) - 50) / max(np.median(b), 1e-3)))
    return 0 if ita > 41 else 1 if ita > 28 else 2 if ita > 10 else 3


def lifted(image):
    """Display copy: dark patches gamma-lifted towards a mid brightness (mean luma about 125)."""
    luma = (image @ np.array([0.299, 0.587, 0.114])).mean()
    if luma >= 115:
        return image
    gamma = np.log(125 / 255) / np.log(max(luma, 1) / 255)
    return np.clip(255 * (image / 255.0) ** gamma, 0, 255).astype(np.uint8)


def from_folder(folder, out):
    names = sorted(n for n in os.listdir(folder) if n.endswith(".png"))
    images = np.stack([np.asarray(Image.open(os.path.join(folder, n)).convert("RGB")) for n in names])
    groups = np.array([ita_band(image) for image in images])
    np.savez_compressed(out, image=images, group=groups, names=np.array(names))
    print(f"{len(images)} patches -> {out}; by tone band (lighter..deep): {np.bincount(groups, minlength=4).tolist()}")


def main():
    args = sys.argv[1:]
    if args and args[0] == "--from-folder":
        return from_folder(args[1], args[2])
    if len(args) < 2:
        raise SystemExit(__doc__)
    src, out = args[0], args[1]
    count = int(args[args.index("--pairs") + 1]) if "--pairs" in args else 300
    data = np.load(src)
    images, groups = data["image"], data["group"]
    if images.ndim != 4 or images.shape[1:] != (128, 128, 3) or images.dtype != np.uint8:
        raise SystemExit(f"Expected N x 128 x 128 x 3 uint8 patches, got {images.shape} {images.dtype}")
    set_id = hashlib.sha256(images.tobytes()).hexdigest()[:16]
    pairs = pick_pairs(groups, count)

    lift = "--lift" in args
    patches = []
    for image in images:
        image = lifted(image) if lift else image
        buffer = io.BytesIO()
        Image.fromarray(image).save(buffer, "PNG", optimize=True)  # lossless: texture is the point
        patches.append("data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode())

    payload = json.dumps({"setId": set_id, "pairs": pairs, "patches": patches}, separators=(",", ":"))
    template = open(TEMPLATE, encoding="utf-8").read()
    if template.count("__GLOWTRACE_DATA__") != 1:
        raise SystemExit("Template must contain __GLOWTRACE_DATA__ exactly once")
    os.makedirs(out, exist_ok=True)
    page = os.path.join(out, "glowtrace_labelling.html")
    open(page, "w", encoding="utf-8").write(template.replace("__GLOWTRACE_DATA__", payload))
    np.savez_compressed(os.path.join(out, "label_patches.npz"), image=images, group=groups, set_id=set_id, pairs=np.array(pairs))
    size = os.path.getsize(page) / 1e6
    print(f"set {set_id}: {len(images)} patches, {len(pairs)} pairs, page {size:.1f} MB -> {out}")


if __name__ == "__main__":
    main()
