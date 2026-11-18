# Physics-supervised redness model

Trains the redness model used by kernel v2 (`src/lib/cv/redness-model.ts`). Method and results:
`docs/cv-kernel-spec.md` (v2.0). Data: Google SCIN under the SCIN Data Use License; photos are
downloaded, downscaled to 128 px and kept outside the repository. Never commit them.

```bash
# 1. CSVs from the public bucket (see docs/calibration-plan.md), then a balanced sample
python3 prepare.py <folder with scin_cases.csv and scin_labels.csv> 150 <folder>/sample.npz
# 2. Train five members, evaluate on held-out photos, write weights (about 8 minutes on 4 CPUs)
python3 model.py <folder>/sample.npz <folder>/weights.json 5
# 3. Ship: copy weights to src/lib/cv/redness-weights.json, bump KERNEL_VERSION, then update the
#    parity numbers in src/test/redness-model.test.ts with the snippet below and run the tests.
```

Parity snippet (prints the features and ensemble output for the test's formula image):

```python
import json, numpy as np
from model import features
img = np.zeros((24, 32, 3), np.uint8)
for y in range(24):
    for x in range(32):
        img[y, x] = [(150 + 3 * x + y * 2) % 256, (100 + x + 5 * y) % 256, (80 + 2 * x + 3 * y) % 256]
f = features(img)
w = json.load(open("../../src/lib/cv/redness-weights.json"))
outs = []
for m in w["members"]:
    h = (f - np.array(m["mean"])) / np.array(m["std"])
    for i, layer in enumerate(m["layers"]):
        h = h @ np.array(layer["w"]) + np.array(layer["b"])
        if i < len(m["layers"]) - 1:
            h = np.tanh(h)
    outs.append((h[0] - m["centre"]) / m["scale"])
print(json.dumps({"features": f.round(9).tolist(), "signal": round(float(np.mean(outs)), 9)}))
```

Only ship a retrained model if it beats the current one on every held-out measure and passes
`robustness.test.ts`.
