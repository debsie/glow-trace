"""Download a skin-tone-balanced sample of SCIN close-ups, downscaled, for training.

SCIN is used under the SCIN Data Use License (no re-identification). Photos are kept only as
small downscaled arrays in a local folder outside the repository and never committed.

Usage: python3 prepare.py <folder with scin_cases.csv and scin_labels.csv> <per_group> <out.npz>
"""
import csv
import io
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

BUCKET = "https://storage.googleapis.com/dx-scin-public-data/"
GROUPS = {0: [1, 2], 1: [3, 4], 2: [5, 6], 3: [7, 8, 9, 10]}
SIZE = 128


def main() -> None:
    folder, per_group, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    cases = {r["case_id"]: r for r in csv.DictReader(open(f"{folder}/scin_cases.csv"))}
    labels = list(csv.DictReader(open(f"{folder}/scin_labels.csv")))
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
                rows.append((label["case_id"], case["image_1_path"], tone, group))
        rows.sort()
        picks += rows[:per_group]

    def load(item):
        case_id, path, tone, group = item
        try:
            with urllib.request.urlopen(BUCKET + path, timeout=60) as response:
                image = Image.open(io.BytesIO(response.read())).convert("RGB")
        except Exception:
            return None
        image.thumbnail((SIZE, SIZE), Image.BILINEAR)
        canvas = np.zeros((SIZE, SIZE, 3), np.uint8)
        array = np.asarray(image)
        canvas[: array.shape[0], : array.shape[1]] = array
        return case_id, canvas, array.shape[0], array.shape[1], tone, group

    with ThreadPoolExecutor(8) as pool:
        loaded = [x for x in pool.map(load, picks) if x is not None]
    np.savez_compressed(
        out,
        case=np.array([x[0] for x in loaded]),
        image=np.stack([x[1] for x in loaded]),
        height=np.array([x[2] for x in loaded]),
        width=np.array([x[3] for x in loaded]),
        tone=np.array([x[4] for x in loaded]),
        group=np.array([x[5] for x in loaded]),
    )
    print(len(loaded), "photos;", np.bincount(np.array([x[5] for x in loaded])))


if __name__ == "__main__":
    main()
