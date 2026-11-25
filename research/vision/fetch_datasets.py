"""Download every Glowtrace training dataset from Roboflow Universe into data/<area>/.

Needs a free Roboflow API key in the ROBOFLOW_API_KEY environment variable (in Colab: the key
icon, "Secrets"). For each dataset it reads the project's details, skips anything whose licence
says non-commercial, downloads the newest version's images, and records name, link and licence
in data/credits.json (CC BY requires credit). Failures are reported and skipped, never fatal.

Usage: python3 fetch_datasets.py [skin|nails|hair ...]
"""
import json
import os
import shutil
import sys
import urllib.request

DATASETS = {
    "skin": [
        ("workspace-1-myjxi", "acne-detection-cbm6h", "Acne, dark circles, pores, wrinkles"),
        ("facial-zfrfm", "facial-ngz7q", "13 facial concerns"),
        ("work-acne", "pigmentation-jiao4", "Pigmentation and spots"),
        ("testworkspace-p2wq3", "face-goyue", "Melasma, marks, pores"),
        ("skinconcerns", "face-wrinkles-detection-xjlkr", "Wrinkles"),
        ("james-aiart", "acne-jcvgb", "Acne"),
        ("acne-severity", "clinic-data", "Acne severity"),
        # Real selfies with marked pores, roughness, dryness, redness and oiliness (CC BY 4.0 on
        # their pages; the licence check below still runs).
        ("faceinc", "dryness-segm-good-selfies", "Selfies: pores, roughness, dryness, redness"),
        ("faceinc", "dryness-segm-preprocessed-good-selfies", "Selfies, preprocessed"),
        ("faceinc", "skin-type-classification", "Faces by skin type"),
        ("frekkel", "facial-skin-analysis", "Facial skin analysis"),
        ("virli", "face-skin", "Face skin"),
    ],
    "nails": [
        ("sergei-artiukhin-ohqpa", "nails-segmentation-yw1zl", "Nail segmentation"),
        ("vincent-y20l1", "fingernail-nqkfm", "Painted and bare nails"),
        ("nailproject", "healthy_nail", "Healthy nails"),
        ("detect-nmkdb", "nail-xaf95", "Nail segmentation"),
        ("aiit-nail-competition", "nail-segmentation-odcgv", "Nail segmentation"),
        ("nsu-sxhmy", "nails-semantic-segmentation", "Nail segmentation"),
        ("personal-projects-jfbag", "nails_segmentation", "Nail segmentation"),
        ("nailproject-padk9", "nail_segmentation", "Nail segmentation"),
        ("fatima-vahabi", "nail-seg-vfa2h", "Nail segmentation"),
        ("vnrvjiet-mnvm9", "nail-images", "Nail conditions"),
        ("nail-acf3b", "nail_disease_own_dataset", "Nail conditions"),
        ("fatima-wmkf6", "nail-segmentation-jrprm", "Nail segmentation"),
    ],
    "hair": [
        ("hairbaldsemanticsegmentation", "hair_baldness", "Scalp and crown"),
        ("umm-alqura-xm8lk", "hairtype", "Curl types incl. 3b and 4A"),
        ("karthik-k", "face-r74ti", "Afro hair, dreadlocks and other styles"),
        ("custom-yolov5-zxmeo", "hair-type", "Straight, wavy, curly"),
        ("flickr", "hair-54plg", "Straight, curly, bald"),
        ("project-kl-wirwir-gg0a3", "hair-style-kpiqp", "Curly, straight, wavy"),
        ("abc-rjytv", "hair_data", "Hair strands"),
        ("itclab", "hair-detection-lkule", "Hair detection"),
        ("hair-oprdr", "mask_segmentation1", "Hair masks"),
        ("manish-kumar-ytl7z", "hair_dataset_updated", "Hair segmentation"),
        # Scalp and hair-health close-ups (found by scout_datasets.ipynb, CC BY 4.0).
        ("sreenithi", "hairproblems-detection", "Good hair, dry scalp, dandruff, oiliness, white hair"),
        ("husnas-workspace", "head-lice-ai", "Healthy scalp and dandruff"),
        ("scalpdet", "scalp-data-iqjst", "Scalp dandruff and oiliness"),
        ("scalpdet", "dandruff-big-chunks", "Dandruff close-ups"),
        ("rooted", "hair-loss-nq8hh-tqveb", "Hair thinning levels"),
        ("major-project-s3rff", "hair-disease-detection-o2ok0", "Scalp conditions"),
    ],
}

# GLOWTRACE_UNSPLASH_ZIP and GLOWTRACE_FETCH_LIMIT exist only for rehearsing the notebook offline.
FETCH_LIMIT = int(os.environ.get("GLOWTRACE_FETCH_LIMIT", "0")) or None

def fetch_bytes(url, timeout=600, tries=4):
    """GET with retries: busy servers (HTTP 429 or 5xx) and dropped connections get three more
    tries after 30 s, 60 s and 120 s, honouring a Retry-After header when the server sends one."""
    import time
    import urllib.error

    for attempt in range(tries):
        try:
            return urllib.request.urlopen(url, timeout=timeout).read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            wait = int(error.headers.get("Retry-After") or 0) or 30 * 2**attempt
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == tries - 1:
                raise
            wait = 30 * 2**attempt
        print(f"     busy, retrying in {min(wait, 300)} s: {url[:80]}", flush=True)
        time.sleep(min(wait, 300))
    raise RuntimeError("unreachable")


NON_COMMERCIAL = ("non-commercial", "noncommercial", "-nc", " nc", "by-nc", "private", "research only")


def project_info(workspace, project, key):
    url = f"https://api.roboflow.com/{workspace}/{project}?api_key={key}"
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode())


def licence_of(info):
    """Roboflow does not document a licence field; look in the usual places."""
    project = info.get("project", info)
    for key in ("license", "licence", "license_name"):
        value = project.get(key) or info.get(key)
        if value:
            return str(value)
    return None


ZENODO_SCALP = "https://zenodo.org/api/records/23433121"


def zenodo_scalp(credits):
    """ScalpHairLabels v1 (CC BY 4.0): 504 scalp close-up tiles cut from CC0 ISIC images."""
    import io
    import urllib.request
    import zipfile

    target = os.path.join("data", "hair", "zenodo__scalphairlabels")
    link = "https://zenodo.org/records/23433121"
    try:
        record = json.loads(fetch_bytes(ZENODO_SCALP, timeout=60))
        os.makedirs(target, exist_ok=True)
        for entry in record.get("files", []):
            if "tiles" not in entry["key"]:
                continue
            data = fetch_bytes(entry["links"]["self"])
            zipfile.ZipFile(io.BytesIO(data)).extractall(target)
        count = sum(1 for _, _, files in os.walk(target) for f in files if f.lower().endswith((".jpg", ".jpeg", ".png")))
        print(f"OK   hair: ScalpHairLabels v1 ({count} tiles, licence: CC BY 4.0, source photos CC0)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "hair", "name": "ScalpHairLabels v1", "what": "Scalp close-ups (ISIC, CC0)",
                        "link": link, "licence": "CC BY 4.0", "images": count})
    except Exception as error:
        print(f"FAIL hair: ScalpHairLabels ({str(error)[:120]})")
    return credits


def fairface(credits, per_group=min(450, FETCH_LIMIT or 450)):
    """FairFace (CC BY 4.0): faces balanced across seven ethnic groups, many real lighting
    conditions. Tight crops (0.25 padding), up to per_group faces per group."""
    import io

    import pandas as pd

    target = os.path.join("data", "skin", "fairface")
    link = "https://github.com/joojs/fairface"
    try:
        files = json.loads(fetch_bytes("https://huggingface.co/api/datasets/HuggingFaceM4/FairFace/parquet", timeout=60))["0.25"]["train"]
        os.makedirs(target, exist_ok=True)
        counts, saved = {}, 0
        for url in files:
            frame = pd.read_parquet(io.BytesIO(fetch_bytes(url, timeout=900)))
            for _, row in frame.iterrows():
                group = str(row.get("race", "unknown"))
                if counts.get(group, 0) >= per_group:
                    continue
                image = row["image"]
                data = image.get("bytes") if isinstance(image, dict) else None
                if not data:
                    continue
                open(os.path.join(target, f"{group}_{counts.get(group, 0):04d}.jpg"), "wb").write(data)
                counts[group] = counts.get(group, 0) + 1
                saved += 1
            if counts and min(counts.values()) >= per_group and len(counts) >= 7:
                break
        print(f"OK   skin: FairFace ({saved} faces, {len(counts)} groups, licence: CC BY 4.0)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "skin", "name": "FairFace", "what": "Faces balanced across seven ethnic groups",
                        "link": link, "licence": "CC BY 4.0", "images": saved})
    except Exception as error:
        print(f"FAIL skin: FairFace ({str(error)[:120]})")
    return credits


FIGSHARE_NAILS = "https://ndownloader.figshare.com/files/49504041"


def figshare_nails(credits):
    """Skin and fingernails for haemoglobin assessment (Yakimov et al., Scientific Data 2024;
    figshare 25867432, CC0): 252 hand photos of bare nails with nail boxes. Each nail is cut out
    with a 15% margin, the way the nail models read nail tiles."""
    import ast
    import csv
    import io
    import zipfile

    from PIL import Image

    target = os.path.join("data", "nails", "figshare_haemoglobin")
    link = "https://doi.org/10.6084/m9.figshare.25867432.v1"
    try:
        archive = zipfile.ZipFile(io.BytesIO(fetch_bytes(FIGSHARE_NAILS)))
        rows = list(csv.DictReader(io.TextIOWrapper(archive.open("metadata.csv"), "utf-8")))
        os.makedirs(target, exist_ok=True)
        saved = 0
        for row in rows:
            name = f"photo/{row['PATIENT_ID']}.jpg"
            if name not in archive.namelist():
                continue
            # Boxes are [top, left, bottom, right] on the photo as stored (checked by eye on a contact
            # sheet: every crop is a nail); don't apply the EXIF rotation.
            photo = Image.open(io.BytesIO(archive.read(name))).convert("RGB")
            for k, box in enumerate(ast.literal_eval(row["NAIL_BOUNDING_BOXES"])):
                y0, y1 = sorted((box[0], box[2]))
                x0, x1 = sorted((box[1], box[3]))
                if x1 - x0 < 8 or y1 - y0 < 8 or x1 > photo.width or y1 > photo.height:
                    continue
                mx, my = int((x1 - x0) * 0.15), int((y1 - y0) * 0.15)
                tile = photo.crop((max(0, x0 - mx), max(0, y0 - my), min(photo.width, x1 + mx), min(photo.height, y1 + my)))
                tile.save(os.path.join(target, f"{row['PATIENT_ID']}_{k}.jpg"), quality=92)
                saved += 1
        print(f"OK   nails: figshare haemoglobin nails ({saved} nail tiles, licence: CC0)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "nails", "name": "Skin and fingernails (Yakimov et al. 2024)", "what": "Bare nail tiles from hand photos",
                        "link": link, "licence": "CC0 1.0", "images": saved})
    except Exception as error:
        print(f"FAIL nails: figshare haemoglobin nails ({str(error)[:120]})")
    return credits


OPEN_IMAGES_BOXES = "https://storage.googleapis.com/openimages/v5/validation-annotations-bbox.csv"
OPEN_IMAGES_META = "https://storage.googleapis.com/openimages/2018_04/validation/validation-images-with-rotation.csv"
HUMAN_HAIR = "/m/03q69"


def open_images_hair(credits, limit=min(1500, FETCH_LIMIT or 1500)):
    """Open Images V7 validation photos with a "Human hair" box (annotations CC BY 4.0). Only images
    whose own licence is CC BY 2.0 are kept; the author and source are recorded per image in
    data/hair/openimages/attribution.csv. Open Images has no hair masks, so hair areas come from
    the hair guide during training, as for every other hair photo."""
    import csv
    import io
    from concurrent.futures import ThreadPoolExecutor

    target = os.path.join("data", "hair", "openimages")
    link = "https://storage.googleapis.com/openimages/web/index.html"
    try:
        boxes = fetch_bytes(OPEN_IMAGES_BOXES).decode()
        with_hair = {r["ImageID"] for r in csv.DictReader(io.StringIO(boxes)) if r["LabelName"] == HUMAN_HAIR}
        meta = fetch_bytes(OPEN_IMAGES_META).decode()
        rows = [
            r for r in csv.DictReader(io.StringIO(meta))
            if r["ImageID"] in with_hair and r["License"].rstrip("/").endswith("licenses/by/2.0")
        ]
        rows = sorted(rows, key=lambda r: r["ImageID"])[:limit]
        os.makedirs(target, exist_ok=True)

        def one(row):
            try:
                url = f"https://open-images-dataset.s3.amazonaws.com/validation/{row['ImageID']}.jpg"
                open(os.path.join(target, f"{row['ImageID']}.jpg"), "wb").write(urllib.request.urlopen(url, timeout=60).read())
                return row
            except Exception:
                return None

        with ThreadPoolExecutor(8) as pool:
            kept = [r for r in pool.map(one, rows) if r]
        with open(os.path.join(target, "attribution.csv"), "w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["image", "author", "source", "licence"])
            for r in kept:
                writer.writerow([f"{r['ImageID']}.jpg", r["Author"], r["OriginalLandingURL"], r["License"]])
        print(f"OK   hair: Open Images hair ({len(kept)} of {len(rows)} photos, licence: CC BY 2.0 images, CC BY 4.0 annotations)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "hair", "name": "Open Images V7 (Human hair)", "what": "Photos with hair, per-image credits in attribution.csv",
                        "link": link, "licence": "Images CC BY 2.0; annotations CC BY 4.0", "images": len(kept)})
    except Exception as error:
        print(f"FAIL hair: Open Images hair ({str(error)[:120]})")
    return credits


UNSPLASH_LITE = os.environ.get("GLOWTRACE_UNSPLASH_ZIP", "https://unsplash.com/data/lite/latest")
UNSPLASH_WORDS = {"selfie", "face", "headshot", "portrait", "skin", "close up", "closeup"}


# Roboflow Universe "skin tone" by Aman (aman-x15w6/skin-tone-9drvk-n4aym), listed as CC BY 4.0, exported
# by the owner (v1, folder structure) to Google Drive. The page names no source or consent for its
# photos; the owner chose to train on it (research/vision/README.md). To remove it from training, set
# GLOWTRACE_NO_ROBOFLOW_SKINTONE=1 (or empty this URL) and retrain.
ROBOFLOW_SKINTONE_ZIP = "https://drive.usercontent.google.com/download?id=1D4alsHW0k3DGlkKO0Ytoe2JJDzdPevX6&export=download&confirm=t"


def roboflow_skintone(credits):
    """Faces at many angles (front, three-quarter, side) labelled light / fair / dark. Original photos
    only: the export's "augmented_" files are flipped or altered copies (440, all in "dark")."""
    import io
    import zipfile

    if os.environ.get("GLOWTRACE_NO_ROBOFLOW_SKINTONE") or not ROBOFLOW_SKINTONE_ZIP:
        print("SKIP skin: Roboflow skin tone (switched off)")
        return [c for c in credits if c.get("name") != "Roboflow skin tone (Aman)"]
    target = os.path.join("data", "skin", "roboflow_skintone")
    link = "https://universe.roboflow.com/aman-x15w6/skin-tone-9drvk-n4aym"
    # Children are never used: Glowtrace is adults only (roboflow_skintone_exclude.txt, checked by eye).
    here = os.path.dirname(os.path.abspath(__file__))
    exclude_path = os.path.join(here, "roboflow_skintone_exclude.txt")
    if not os.path.exists(exclude_path):
        print("SKIP skin: Roboflow skin tone (children list missing; never train on it without)")
        return credits
    exclude = {line.strip() for line in open(exclude_path) if line.strip() and not line.startswith("#")}
    try:
        archive = zipfile.ZipFile(io.BytesIO(fetch_bytes(ROBOFLOW_SKINTONE_ZIP, timeout=1800)))
        os.makedirs(target, exist_ok=True)
        saved = 0
        for name in archive.namelist():
            base = os.path.basename(name)
            if not base.lower().endswith((".jpg", ".jpeg", ".png")) or base.startswith("augmented"):
                continue
            if base in exclude:
                continue
            if name.startswith("/") or ".." in name:
                continue
            tone = os.path.basename(os.path.dirname(name)) or "unknown"
            open(os.path.join(target, f"{tone}_{saved:05d}{os.path.splitext(base)[1]}"), "wb").write(archive.read(name))
            saved += 1
        print(f"OK   skin: Roboflow skin tone ({saved} original adult photos, {len(exclude)} children left out, licence as listed: CC BY 4.0, source not stated)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "skin", "name": "Roboflow skin tone (Aman)", "what": "Faces at many angles, light / fair / dark",
                        "link": link, "licence": "CC BY 4.0 as listed by the uploader (no source stated)", "images": saved})
    except Exception as error:
        print(f"FAIL skin: Roboflow skin tone ({str(error)[:120]})")
    return credits


def unsplash_faces(credits, limit=min(1200, FETCH_LIMIT or 1200)):
    """Unsplash Lite (Unsplash Dataset Terms: commercial training for internal business use,
    never redistributed): photos tagged selfie, face, portrait, skin or close-up, 1024 px wide.
    Training keeps only skin-rich patches, so non-face photos drop out on their own."""
    import csv
    import io
    import zipfile
    from concurrent.futures import ThreadPoolExecutor

    target = os.path.join("data", "skin", "unsplash_lite")
    link = "https://unsplash.com/data"
    try:
        archive = zipfile.ZipFile(io.BytesIO(fetch_bytes(UNSPLASH_LITE, timeout=1800)))
        csv.field_size_limit(10**8)
        names = archive.namelist()
        wanted = set()
        with archive.open(next(n for n in names if n.startswith("keywords"))) as handle:
            for row in csv.DictReader(io.TextIOWrapper(handle, "utf-8"), delimiter="\t"):
                if row.get("keyword", "").lower() in UNSPLASH_WORDS:
                    wanted.add(row["photo_id"])
        urls = []
        with archive.open(next(n for n in names if n.startswith("photos"))) as handle:
            for row in csv.DictReader(io.TextIOWrapper(handle, "utf-8"), delimiter="\t"):
                if row.get("photo_id") in wanted and row.get("photo_image_url"):
                    urls.append((row["photo_id"], row["photo_image_url"] + "?w=1024&fm=jpg&q=90"))
        urls = sorted(urls)[:limit]
        os.makedirs(target, exist_ok=True)

        def one(item):
            try:
                data = urllib.request.urlopen(item[1], timeout=60).read()
                open(os.path.join(target, f"{item[0]}.jpg"), "wb").write(data)
                return 1
            except Exception:
                return 0

        with ThreadPoolExecutor(8) as pool:
            saved = sum(pool.map(one, urls))
        print(f"OK   skin: Unsplash Lite faces ({saved} of {len(urls)} photos, licence: Unsplash Dataset Terms, Lite)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "skin", "name": "Unsplash Lite (faces)", "what": "Selfies, portraits and skin close-ups",
                        "link": link, "licence": "Unsplash Dataset Terms (Lite: commercial internal training, no redistribution)", "images": saved})
    except Exception as error:
        print(f"FAIL skin: Unsplash Lite ({str(error)[:120]})")
    return credits


def main():
    key = os.environ.get("ROBOFLOW_API_KEY")
    # A missing or rejected key skips the Roboflow sets only; every other source still downloads.
    rf = None
    if key and not os.environ.get("GLOWTRACE_SKIP_ROBOFLOW"):
        try:
            from roboflow import Roboflow

            rf = Roboflow(api_key=key)
        except Exception as error:
            print(f"FAIL roboflow: key rejected or service down ({str(error)[:120]}); skipping Roboflow sets")
    else:
        print("SKIP roboflow: no ROBOFLOW_API_KEY")
    areas = [a for a in sys.argv[1:] if a in DATASETS] or list(DATASETS)
    os.makedirs("data", exist_ok=True)
    credits_path = os.path.join("data", "credits.json")
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else []
    for area in areas:
        for workspace, project, what in DATASETS[area] if rf else []:
            link = f"https://universe.roboflow.com/{workspace}/{project}"
            target = os.path.join("data", area, f"{workspace}__{project}")
            try:
                info = project_info(workspace, project, key)
                licence = licence_of(info)
                if licence and any(word in licence.lower() for word in NON_COMMERCIAL):
                    print(f"SKIP {area}: {project} (licence: {licence})")
                    continue
                versions = rf.workspace(workspace).project(project).versions()
                if not versions:
                    print(f"SKIP {area}: {project} (no downloadable version)")
                    continue
                newest = sorted(versions, key=lambda v: int(str(v.version).split("/")[-1]))[-1]
                if os.path.exists(target):
                    shutil.rmtree(target)
                for fmt in ("coco", "coco-segmentation", "yolov8", "folder"):
                    try:
                        newest.download(fmt, location=target, overwrite=True)
                        break
                    except Exception:
                        continue
                count = sum(
                    1
                    for root, _, files in os.walk(target)
                    for f in files
                    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                )
                print(f"OK   {area}: {project} ({count} images, licence: {licence or 'not reported, check the page'})")
                credits = [c for c in credits if c["link"] != link]
                credits.append({"area": area, "name": project, "what": what, "link": link, "licence": licence, "images": count})
            except Exception as error:
                print(f"FAIL {area}: {project} ({str(error)[:120]})")
    if "hair" in areas:
        credits = zenodo_scalp(credits)
    if "nails" in areas:
        credits = figshare_nails(credits)
    if "hair" in areas:
        credits = open_images_hair(credits)
    if "skin" in areas:
        credits = fairface(credits)
        credits = unsplash_faces(credits)
        credits = roboflow_skintone(credits)
    json.dump(credits, open(credits_path, "w"), indent=2)
    print(f"\nCredits written to {credits_path}. Check any 'not reported' licence on its page before shipping.")


if __name__ == "__main__":
    main()
