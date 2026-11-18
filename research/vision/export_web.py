"""Packs <area>_weights.json for the app: float32 tensors as base64, plus a parity reference.

Usage: python research/vision/export_web.py hair_weights.json src/lib/cv/hair-weights.json
"""

import base64
import json
import sys

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class UNet(nn.Module):
    """Same network as multitask.py (copied so importing does not start a training run)."""

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

src, dst = sys.argv[1], sys.argv[2]
raw = json.load(open(src))
model = UNet(len(raw["heads"]))
model.load_state_dict({k: torch.tensor(v) for k, v in raw["weights"].items()})
model.eval()

# Parity image: the same formula as src/test/hair-model.test.ts, 128 x 128, fully valid.
y, x = np.mgrid[0:128, 0:128]
rgb = np.stack([(150 + 3 * x + 2 * y) % 256, (100 + x + 5 * y) % 256, (80 + 2 * x + 3 * y) % 256], -1)
t = torch.tensor(rgb, dtype=torch.float32).permute(2, 0, 1)[None]
inp = torch.cat([-torch.log((t + 0.5) / 255.5) / 3.0, torch.ones(1, 1, 128, 128)], 1)
with torch.no_grad():
    out = model(inp)[0].mean((1, 2)).numpy() / 10.0

tensors = {
    k: {"shape": list(v.shape), "data": base64.b64encode(v.detach().numpy().astype("<f4").tobytes()).decode()}
    for k, v in model.state_dict().items()
}
json.dump(
    {
        "area": raw["area"],
        "heads": raw["heads"],
        "size": raw["size"],
        "evaluation": raw["evaluation"],
        "parity": {h: round(float(out[i]), 6) for i, h in enumerate(raw["heads"])},
        "tensors": tensors,
    },
    open(dst, "w"),
)
print("wrote", dst, dict(zip(raw["heads"], out.round(6).tolist())))
