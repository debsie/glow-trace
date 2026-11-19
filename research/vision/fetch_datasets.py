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
        record = json.loads(urllib.request.urlopen(ZENODO_SCALP, timeout=60).read())
        os.makedirs(target, exist_ok=True)
        for entry in record.get("files", []):
            if "tiles" not in entry["key"]:
                continue
            data = urllib.request.urlopen(entry["links"]["self"], timeout=600).read()
            zipfile.ZipFile(io.BytesIO(data)).extractall(target)
        count = sum(1 for _, _, files in os.walk(target) for f in files if f.lower().endswith((".jpg", ".jpeg", ".png")))
        print(f"OK   hair: ScalpHairLabels v1 ({count} tiles, licence: CC BY 4.0, source photos CC0)")
        credits = [c for c in credits if c["link"] != link]
        credits.append({"area": "hair", "name": "ScalpHairLabels v1", "what": "Scalp close-ups (ISIC, CC0)",
                        "link": link, "licence": "CC BY 4.0", "images": count})
    except Exception as error:
        print(f"FAIL hair: ScalpHairLabels ({str(error)[:120]})")
    return credits


def main():
    key = os.environ.get("ROBOFLOW_API_KEY")
    if not key:
        raise SystemExit("Set ROBOFLOW_API_KEY first (Colab: key icon > Secrets).")
    from roboflow import Roboflow

    rf = Roboflow(api_key=key)
    areas = [a for a in sys.argv[1:] if a in DATASETS] or list(DATASETS)
    os.makedirs("data", exist_ok=True)
    credits_path = os.path.join("data", "credits.json")
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else []
    for area in areas:
        for workspace, project, what in DATASETS[area]:
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
    json.dump(credits, open(credits_path, "w"), indent=2)
    print(f"\nCredits written to {credits_path}. Check any 'not reported' licence on its page before shipping.")


if __name__ == "__main__":
    main()
