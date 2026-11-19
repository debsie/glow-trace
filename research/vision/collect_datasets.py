"""Download every usable dataset from scout_report.json into data/<area>/ and record credits.

Takes only finds whose licence allows commercial use ("ok"), that look relevant to their area and
are a sensible size. Roboflow sets come through the Roboflow API (your key); Zenodo and Figshare
files are fetched directly and unzipped. Hugging Face sets are skipped unless --include-hf, because
most have no record of where their photos came from. Every download is marked "provenance:
check" in data/credits.json until Claude has traced where its photos came from.

Usage: python collect_datasets.py [--include-hf] [--max-gb 5]
"""

import io
import json
import os
import re
import sys
import urllib.request
import zipfile

MAX_GB = float(sys.argv[sys.argv.index("--max-gb") + 1]) if "--max-gb" in sys.argv else 5.0
INCLUDE_HF = "--include-hf" in sys.argv
WORDS = {
    "skin": r"skin|face|facial|acne|pigment|melasma|lesion|derm|wrinkle|pore|selfie|lip|makeup",
    "hair": r"hair|scalp|dandruff|braid|loc|curl|afro|trich|alopecia|bald",
    "nails": r"nail|finger|hand|manicure|cuticle|polish",
}


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def gigabytes(size):
    match = re.match(r"([\d.]+)\s*GB", size or "")
    return float(match.group(1)) if match else None


def fetch(url, timeout=900):
    request = urllib.request.Request(url, headers={"User-Agent": "glowtrace-collect/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def unpack(data, name, target):
    os.makedirs(target, exist_ok=True)
    if name.lower().endswith(".zip"):
        zipfile.ZipFile(io.BytesIO(data)).extractall(target)
    elif name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        open(os.path.join(target, os.path.basename(name)), "wb").write(data)


def count_images(target):
    return sum(1 for _, _, files in os.walk(target) for f in files
               if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))


def zenodo(link, target):
    record = json.loads(fetch(f"https://zenodo.org/api/records/{link.rstrip('/').split('/')[-1]}"))
    for entry in record.get("files", []):
        if entry["key"].lower().endswith((".zip", ".jpg", ".jpeg", ".png")):
            unpack(fetch(entry["links"]["self"]), entry["key"], target)


def figshare(link, target):
    article = link.rstrip("/").split("/")[-1]
    detail = json.loads(fetch(f"https://api.figshare.com/v2/articles/{article}"))
    for entry in detail.get("files", []):
        if entry["name"].lower().endswith((".zip", ".jpg", ".jpeg", ".png")):
            unpack(fetch(entry["download_url"]), entry["name"], target)


def roboflow(name, target):
    from roboflow import Roboflow
    workspace, project = name.split("/")
    versions = Roboflow(api_key=os.environ["ROBOFLOW_API_KEY"]).workspace(workspace).project(project).versions()
    if not versions:
        raise RuntimeError("no downloadable version")
    newest = sorted(versions, key=lambda v: int(str(v.version).split("/")[-1]))[-1]
    for fmt in ("coco", "coco-segmentation", "yolov8", "folder"):
        try:
            newest.download(fmt, location=target, overwrite=True)
            return
        except Exception:
            continue
    raise RuntimeError("no format downloaded")


def huggingface(name, target, limit=3000):
    from datasets import load_dataset
    os.makedirs(target, exist_ok=True)
    stream = load_dataset(name, split="train", streaming=True)
    saved = 0
    for row in stream:
        image = next((v for v in row.values() if hasattr(v, "save")), None)
        if image is None:
            continue
        image.convert("RGB").save(os.path.join(target, f"{saved:05d}.jpg"), quality=92)
        saved += 1
        if saved >= limit:
            break


def main():
    rows = json.load(open("scout_report.json"))
    os.makedirs("data", exist_ok=True)
    credits_path = os.path.join("data", "credits.json")
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else []
    known = {c["link"] for c in credits}
    for row in rows:
        if row["verdict"] != "ok" or row["link"] in known:
            continue
        if not re.search(WORDS[row["area"]], (row["name"] + " " + row["what"]).lower()):
            print(f"skip (not about {row['area']}): {row['name'][:70]}")
            continue
        size = gigabytes(row["size"])
        if size is not None and size > MAX_GB:
            print(f"skip (too big, {row['size']}): {row['name'][:70]}")
            continue
        if row["source"] == "Hugging Face" and not INCLUDE_HF:
            print(f"skip (Hugging Face, provenance unknown; use --include-hf): {row['name']}")
            continue
        target = os.path.join("data", row["area"], f"{slug(row['source'])}__{slug(row['name'])}")
        try:
            {"Zenodo": zenodo, "Figshare": figshare}.get(row["source"], lambda *_: None)(row["link"], target)
            if row["source"] == "Roboflow":
                roboflow(row["name"], target)
            if row["source"] == "Hugging Face":
                huggingface(row["name"], target)
            images = count_images(target) if os.path.exists(target) else 0
            if images == 0:
                print(f"none  {row['source']}: {row['name'][:70]} (no images in the files)")
                continue
            print(f"OK    {row['source']}: {row['name'][:70]} ({images} images)")
            credits.append({"area": row["area"], "name": row["name"], "what": row["what"], "link": row["link"],
                            "licence": row["licence"], "images": images, "provenance": "check"})
            json.dump(credits, open(credits_path, "w"), indent=2)
        except Exception as error:
            print(f"FAIL  {row['source']}: {row['name'][:70]} ({str(error)[:100]})")
    print(f"\nCredits in {credits_path}. Send it to Claude so each new set's photo sources can be checked.")


if __name__ == "__main__":
    main()
