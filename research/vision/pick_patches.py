"""Picks well-lit skin patches for a labelling round, weighted towards brown and deep skin.

Usage: python3 research/vision/pick_patches.py <patch_dir> <out_dir> [seed]

Keeps patches with median luma 45-215 (deep skin included), at most 0.5% clipped pixels and no
strong edges (99th percentile gradient <= 6.5: glasses, nostrils, eyelids), then takes up to
45 / 45 / 75 / 75 per skin-tone band (lighter to deep). The deep-skin round exists because the
labeller skipped half the deep-skin pairs in round 2, which were often dim.
"""
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image

from make_label_page import ita_band

WANT = {0: 45, 1: 45, 2: 75, 3: 75}


def main():
    src, out = sys.argv[1], sys.argv[2]
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    keep = {band: [] for band in WANT}
    for path in sorted(glob.glob(os.path.join(src, "*.png"))):
        image = np.asarray(Image.open(path).convert("RGB"))
        luma = image.astype(float) @ [0.299, 0.587, 0.114]
        gy, gx = np.gradient(luma)
        if not 45 <= np.median(luma) <= 215:
            continue
        if (image >= 250).any(2).mean() > 0.005 or np.percentile(np.hypot(gx, gy), 99) > 6.5:
            continue
        keep[ita_band(image)].append(path)
    rng = np.random.default_rng(seed)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for band, paths in keep.items():
        for path in rng.permutation(paths)[: WANT[band]]:
            shutil.copy(path, out)
    print({band: min(len(paths), WANT[band]) for band, paths in keep.items()}, "->", out)


if __name__ == "__main__":
    main()
