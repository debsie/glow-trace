"""Physics-supervised redness model for Glowtrace.

No one labels "how red" a photo is, so we make labels with physics. Skin colour follows the
Beer-Lambert law: in optical density (OD = -ln reflectance) absorbers add. Adding a known amount
of haemoglobin to the skin pixels of a real photo therefore gives a photo whose extra redness is
known exactly. Each training example is a pair of views of the same real photo, each under its
own random light, exposure, blur and sensor noise, one with c extra haemoglobin. The model f is
trained so that f(view B) - f(view A) = c. It must ignore light and camera, and respond to blood.
A fairness term keeps f's average on the unaltered photos equal across skin-tone groups.

The model is a small MLP over 18 colour statistics of the skin pixels. Its weights are exported
as JSON and run in TypeScript on the device (src/lib/cv/redness-model.ts). Features here must
match that file exactly.

Usage: python3 model.py <sample.npz> <out_weights.json> [seed]
"""
import json
import sys

import numpy as np

# ---------- Features (mirror of src/lib/cv/redness-model.ts) ----------

XN, YN, ZN = 0.95047, 1.0, 1.08883
PERCENTILES = (0.1, 0.5, 0.9)
MIN_SKIN_SHARE = 0.1


def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lab_f(t):
    return np.where(t > 216 / 24389, np.cbrt(t), (841 / 108) * t + 4 / 29)


def rgb_to_lab(rgb):
    lin = srgb_to_linear(rgb.astype(np.float64))
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
    z = r * 0.0193339 + g * 0.119192 + b * 0.9503041
    fx, fy, fz = lab_f(x / XN), lab_f(y / YN), lab_f(z / ZN)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def percentile(values, q):
    s = np.sort(values)
    return float(s[int(np.floor(q * (len(s) - 1)))])


def illuminant(rgb, p=6):
    flat = rgb.reshape(-1, 3).astype(np.float64)
    mx = flat.max(axis=1)
    keep = flat[(mx < 250) & (mx > 10)]
    if len(keep) == 0:
        return 1 / 3, 1 / 3, 1 / 3
    e = (np.mean((keep / 255.0) ** p, axis=0)) ** (1 / p)
    e = e / (e.sum() or 1)
    return float(e[0]), float(e[1]), float(e[2])


def features(rgb):
    """rgb: H x W x 3 uint8 (already clipped). Returns 18 floats."""
    L, a, b = rgb_to_lab(rgb)
    hue = np.degrees(np.arctan2(b, a))
    mask = (L > 20) & (L < 95) & (a > 2) & (hue > 10) & (hue < 80)
    share = float(mask.mean())
    if share < MIN_SKIN_SHARE:
        mask = np.ones_like(mask)
    px = rgb.astype(np.float64)[mask]
    od = -np.log((px + 0.5) / 255.5)
    dG = od[:, 1] - od[:, 0]
    dB = od[:, 2] - od[:, 0]
    out = []
    for values in (dG, dB, a[mask], b[mask], L[mask]):
        out += [percentile(values, q) for q in PERCENTILES]
    er, eg, eb = illuminant(rgb)
    out += [er, eb, share]
    return np.array(out)


# ---------- Physics simulator ----------

# Haemoglobin optical-density direction in camera R, G, B. From the extinction spectrum of
# oxyhaemoglobin averaged over typical camera bands (strong in green and blue, weak in red).
# Uncertain, so each example jitters it: the model must not depend on the exact vector.
HB = np.array([0.04, 1.0, 0.85])


def render(rgb, rng, c, skin_weight):
    """Add c haemoglobin (weighted per pixel), then random light, exposure, blur and noise."""
    img = rgb.astype(np.float64)
    if c != 0:
        hb = HB * rng.uniform(0.8, 1.2, 3)
        hb /= hb[1]
        od = -np.log((img + 0.5) / 255.5) + c * skin_weight[..., None] * hb
        img = 255.5 * np.exp(-od) - 0.5
    gains = np.exp(rng.normal(0, 0.07, 3)) * np.exp(rng.normal(0, 0.15))
    img = img * gains
    if rng.random() < 0.4:
        k = rng.integers(1, 3)
        pad = np.pad(img, ((k, k), (k, k), (0, 0)), mode="edge")
        acc = np.zeros_like(img)
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                acc += pad[k + dy : k + dy + img.shape[0], k + dx : k + dx + img.shape[1]]
        img = acc / (2 * k + 1) ** 2
    img = img + rng.normal(0, rng.uniform(0.5, 3.0), img.shape)
    return np.clip(np.round(img), 0, 255).astype(np.uint8)


def skin_weight(rgb, rng):
    """Where the extra blood goes: all skin, or a soft blob covering part of it."""
    L, a, b = rgb_to_lab(rgb)
    hue = np.degrees(np.arctan2(b, a))
    skin = ((L > 20) & (L < 95) & (a > 2) & (hue > 10) & (hue < 80)).astype(np.float64)
    if skin.mean() < MIN_SKIN_SHARE:
        skin = np.ones_like(skin)
    if rng.random() < 0.5:
        return skin, 1.0
    h, w = skin.shape
    cy, cx = rng.uniform(0, h), rng.uniform(0, w)
    sigma = rng.uniform(0.15, 0.5) * max(h, w)
    yy, xx = np.mgrid[0:h, 0:w]
    blob = np.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * sigma**2))
    weight = skin * blob
    coverage = float(weight.sum() / max(skin.sum(), 1))
    return weight, coverage


def make_pairs(images, rng, per_image, groups=None):
    """Deeper skin tones (group 3) are rarer in SCIN, so they get twice the pairs."""
    xa, xb, target = [], [], []
    for index, rgb in enumerate(images):
        repeats = per_image * (2 if groups is not None and groups[index] == 3 else 1)
        for _ in range(repeats):
            c = 0.0 if rng.random() < 0.25 else rng.uniform(-0.08, 0.25)
            weight, coverage = skin_weight(rgb, rng)
            a = render(rgb, rng, 0.0, weight)
            b = render(rgb, rng, c, weight)
            xa.append(features(a))
            xb.append(features(b))
            # The label is the extra haemoglobin averaged over the skin.
            target.append(c * coverage)
    return np.array(xa), np.array(xb), np.array(target)


# ---------- Model ----------


def init(rng, sizes):
    return [
        (rng.normal(0, np.sqrt(1 / i), (i, o)), np.zeros(o)) for i, o in zip(sizes[:-1], sizes[1:])
    ]


def forward(params, x):
    h = x
    cache = []
    for i, (w, b) in enumerate(params):
        z = h @ w + b
        cache.append((h, z))
        h = np.tanh(z) if i < len(params) - 1 else z
    return h[:, 0], cache


def backward(params, cache, grad_out):
    grads = []
    g = grad_out[:, None]
    for i in reversed(range(len(params))):
        h, z = cache[i]
        if i < len(params) - 1:
            g = g * (1 - np.tanh(z) ** 2)
        grads.append((h.T @ g, g.sum(axis=0)))
        g = g @ params[i][0].T
    return list(reversed(grads))


def train(xa, xb, target, originals, groups, rng, epochs=400, lr=2e-3, fairness=2.0):
    mean, std = np.concatenate([xa, xb]).mean(0), np.concatenate([xa, xb]).std(0) + 1e-9
    na, nb, no = (xa - mean) / std, (xb - mean) / std, (originals - mean) / std
    params = init(rng, [na.shape[1], 32, 32, 1])
    m = [(np.zeros_like(w), np.zeros_like(b)) for w, b in params]
    v = [(np.zeros_like(w), np.zeros_like(b)) for w, b in params]
    step = 0
    for epoch in range(epochs):
        order = rng.permutation(len(na))
        for start in range(0, len(order), 256):
            idx = order[start : start + 256]
            fa, ca = forward(params, na[idx])
            fb, cb = forward(params, nb[idx])
            err = (fb - fa) - target[idx] * 10  # scale target to ~unit range
            ga = backward(params, ca, -2 * err / len(idx))
            gb = backward(params, cb, 2 * err / len(idx))
            # Fairness: equal mean output across skin-tone groups on the unaltered photos.
            fo, co = forward(params, no)
            means = np.array([fo[groups == k].mean() for k in range(4)])
            gfo = np.zeros_like(fo)
            for k in range(4):
                sel = groups == k
                gfo[sel] = fairness * 2 * (means[k] - means.mean()) / sel.sum()
            gf = backward(params, co, gfo)
            step += 1
            for i in range(len(params)):
                for j in range(2):
                    grad = ga[i][j] + gb[i][j] + gf[i][j]
                    m[i][j][...] = 0.9 * m[i][j] + 0.1 * grad
                    v[i][j][...] = 0.999 * v[i][j] + 0.001 * grad**2
                    mh = m[i][j] / (1 - 0.9**step)
                    vh = v[i][j] / (1 - 0.999**step)
                    params[i][j][...] -= lr * mh / (np.sqrt(vh) + 1e-8)
    return params, mean, std


def predict(params, mean, std, x):
    return forward(params, (x - mean) / std)[0]


def main():
    data = np.load(sys.argv[1])
    out = sys.argv[2]
    members = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    # Load each array once: indexing the archive directly re-reads it every time.
    stack, heights, widths = data["image"], data["height"], data["width"]
    images = [stack[i, : heights[i], : widths[i]].copy() for i in range(len(stack))]
    groups = data["group"]
    split_rng = np.random.default_rng(0)
    order = split_rng.permutation(len(images))
    split = int(0.8 * len(images))
    train_ids, test_ids = order[:split], order[split:]
    originals = np.array([features(images[i]) for i in train_ids])

    # The same held-out pairs judge every model.
    ta, tb, tt = make_pairs([images[i] for i in test_ids], np.random.default_rng(99), 8)
    pair_group = np.repeat(groups[test_ids], 8)
    test_orig = np.array([features(images[i]) for i in test_ids])

    def judge(diff, scores):
        corr = float(np.corrcoef(diff, tt)[0, 1])
        slope = float(np.polyfit(tt, diff, 1)[0])
        noise = float(np.std(diff[tt == 0]) / abs(slope))
        q = np.percentile(scores, [25, 75])
        g = [np.median(scores[groups[test_ids] == k]) for k in range(4)]
        per_group = [
            round(float(np.std(diff[(tt == 0) & (pair_group == k)]) / abs(slope)), 4) for k in range(4)
        ]
        return {
            "light_noise_by_tone": per_group,
            "corr_with_true_change": round(corr, 3),
            "light_noise_in_hb_units": round(noise, 4),
            "tone_spread_over_iqr": round(float((max(g) - min(g)) / (q[1] - q[0])), 3),
        }

    def v13(x):  # current kernel: Lab a* residual from the b* line (median columns)
        return x[:, 7] - (3.21 + 0.539 * x[:, 10])

    report = {"v1.3": judge(v13(tb) - v13(ta), v13(test_orig))}
    trained = []
    for seed in range(members):
        rng = np.random.default_rng(100 + seed)
        xa, xb, target = make_pairs([images[i] for i in train_ids], rng, 16, groups[train_ids])
        params, mean, std = train(xa, xb, target, originals, groups[train_ids], rng)
        # Centre and scale each member on the training photos so averaging is fair.
        o = predict(params, mean, std, originals)
        centre, scale = float(np.median(o)), float(np.std(o)) or 1.0
        trained.append((params, mean, std, centre, scale))
        f = lambda x, m=trained[-1]: (predict(m[0], m[1], m[2], x) - m[3]) / m[4]
        report[f"member {seed}"] = judge(f(tb) - f(ta), f(test_orig))
        print(seed, report[f"member {seed}"], flush=True)

    def ensemble(x):
        return np.mean([(predict(p, m, s, x) - c) / k for p, m, s, c, k in trained], axis=0)

    report["ensemble"] = judge(ensemble(tb) - ensemble(ta), ensemble(test_orig))
    all_scores = ensemble(np.array([features(im) for im in images]))
    print(json.dumps({k: report[k] for k in ("v1.3", "ensemble")}, indent=2))
    r4 = lambda a: np.round(np.asarray(a, dtype=float), 5).tolist()
    json.dump(
        {
            "version": f"physics-redness-1 ({members} members)",
            "features": 18,
            "members": [
                {
                    "mean": r4(m),
                    "std": r4(s),
                    "centre": round(c, 5),
                    "scale": round(k, 5),
                    "layers": [{"w": r4(w), "b": r4(b)} for w, b in p],
                }
                for p, m, s, c, k in trained
            ],
            "score_p10": round(float(np.percentile(all_scores, 10)), 5),
            "score_p90": round(float(np.percentile(all_scores, 90)), 5),
            "evaluation": report,
        },
        open(out, "w"),
    )


if __name__ == "__main__":
    main()
