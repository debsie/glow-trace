"""Glowtrace dataset scout: searches open sources for skin, hair and nail photos and keeps only
what can be used commercially.

Sources: Hugging Face Hub, Zenodo, Wikimedia Commons, Kaggle (optional key) and Roboflow Universe
(licence and size check of known projects, with your key). Writes scout_report.csv and
scout_report.json: every find with its licence verdict, size and link, best first.

Licence verdicts:
  ok          commercial use allowed (CC0, CC BY, MIT, Apache, BSD, ODC-BY, PDDL, CDLA-Permissive)
  share-alike allowed, but derived data must stay under the same licence (CC BY-SA, ODbL)
  no          non-commercial, no-derivatives, research-only or custom
  unknown     no licence found: treat as no until the owner confirms
"""

import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request

TOPICS = {
    "skin": ["skin texture", "facial skin", "acne", "skin redness", "hyperpigmentation", "skin tone",
             "melasma", "dark circles", "wrinkles", "pores", "face skin dataset", "dark skin",
             "skin of colour", "post-inflammatory hyperpigmentation", "rosacea", "oily skin",
             "dry skin", "under eye", "lips", "makeup", "selfie skin", "face parsing"],
    "hair": ["hair texture", "hair damage", "split ends", "frizz", "curly hair", "afro hair",
             "hair segmentation", "scalp", "dandruff", "hair loss", "hair strands", "hair shine",
             "natural hair", "braids", "box braids", "dreadlocks", "hairline", "traction alopecia",
             "grey hair", "hair length", "curl pattern", "trichoscopy", "hair type"],
    "nails": ["fingernail", "nail segmentation", "nail polish", "nail disease", "nail health",
              "onychomycosis", "nail ridges", "hand segmentation", "manicure", "nail art",
              "acrylic nails", "cuticle", "hand keypoints"],
}

OK = ["cc0", "cc-zero", "cc-by-4", "cc-by-3", "cc-by-2", "cc by 4", "cc by 3", "cc by 2", "public domain",
      "pddl", "mit", "apache", "bsd", "odc-by", "cdla-permissive", "attribution 4.0", "attribution 3.0",
      "attribution 2.0", "cc-by", "cc by"]
SHARE = ["cc-by-sa", "cc by-sa", "sharealike", "share-alike", "odbl"]
NO = ["nc", "noncommercial", "non-commercial", "nd", "noderivatives", "research", "academic",
      "other", "unknown"]


def verdict(licence):
    text = (licence or "").lower().replace("_", "-")
    if not text.strip():
        return "unknown"
    if any(re.search(rf"(^|[^a-z]){w}([^a-z]|$)", text) for w in NO):
        return "no"
    if any(w in text for w in SHARE):
        return "share-alike"
    if any(w in text for w in OK):
        return "ok"
    return "unknown"


def get(url, headers=None):
    request = urllib.request.Request(url, headers={"User-Agent": "dataset-scout/1.0", **(headers or {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())


finds = {}


def add(area, source, name, link, licence, size, what):
    key = link.lower()
    if key in finds:
        return
    finds[key] = {"area": area, "source": source, "name": name, "link": link, "licence": licence or "",
                  "verdict": verdict(licence), "size": size, "what": (what or "")[:160].replace("\n", " ")}


def huggingface():
    from huggingface_hub import HfApi
    api = HfApi()
    for area, terms in TOPICS.items():
        for term in terms:
            try:
                for d in api.list_datasets(search=term, full=True, limit=40):
                    tags = d.tags or []
                    licence = next((t.split(":", 1)[1] for t in tags if t.startswith("license:")), "")
                    size = next((t.split(":", 1)[1] for t in tags if t.startswith("size_categories:")), "")
                    if not any(t.startswith("modality:image") or t == "task_categories:image-classification"
                               or "image" in t for t in tags):
                        continue
                    add(area, "Hugging Face", d.id, f"https://huggingface.co/datasets/{d.id}", licence, size, term)
            except Exception as error:
                print("  Hugging Face", term, error)


IMAGEY = re.compile(r"\b(image|images|photo|photos|photograph|dermoscop|segmentation|annotated)\b")
IRRELEVANT = re.compile(r"\b(eeg|meg|mri|ct scan|spectrogram|genom|rna|protein|sequenc)")


def zenodo():
    for area, terms in TOPICS.items():
        for term in terms:
            q = urllib.parse.quote(f'title:"{term}" AND (images OR photographs OR photos)')
            try:
                data = get(f"https://zenodo.org/api/records?q={q}&type=dataset&size=25")
                for hit in data.get("hits", {}).get("hits", []):
                    meta = hit.get("metadata", {})
                    text = (meta.get("title", "") + " " + meta.get("description", "")).lower()
                    if IRRELEVANT.search(text) or not IMAGEY.search(text):
                        continue
                    licence = (meta.get("license") or {}).get("id", "")
                    files = hit.get("files") or []
                    size = f"{sum(f.get('size', 0) for f in files) / 1e9:.1f} GB" if files else ""
                    add(area, "Zenodo", meta.get("title", "")[:90], hit.get("links", {}).get("self_html", ""),
                        licence, size, term)
                time.sleep(0.5)
            except Exception as error:
                print("  Zenodo", term, error)


COMMONS = {"skin": ["Human skin", "Acne", "Freckles"], "hair": ["Human hair", "Afro-textured hair",
           "Curly hair", "Dreadlocks", "Hair braids"], "nails": ["Fingernails", "Nail polish", "Manicure"]}


def wikimedia():
    for area, categories in COMMONS.items():
        for category in categories:
            title = urllib.parse.quote(f"Category:{category}")
            try:
                data = get(f"https://commons.wikimedia.org/w/api.php?action=query&prop=categoryinfo&titles={title}&format=json")
                page = next(iter(data["query"]["pages"].values()))
                files = page.get("categoryinfo", {}).get("files", 0)
                add(area, "Wikimedia Commons", f"Category:{category}",
                    f"https://commons.wikimedia.org/wiki/Category:{urllib.parse.quote(category)}",
                    "CC BY / CC BY-SA / public domain (per file)", f"{files} files",
                    "each file carries its own licence: keep only CC0, CC BY and public domain")
                time.sleep(1.5)
            except Exception as error:
                print("  Wikimedia", category, error)


def figshare():
    for area, terms in TOPICS.items():
        for term in terms:
            try:
                body = json.dumps({"search_for": f'"{term}"', "item_type": 3, "page_size": 20}).encode()
                request = urllib.request.Request("https://api.figshare.com/v2/articles/search", data=body,
                                                 headers={"Content-Type": "application/json", "User-Agent": "dataset-scout/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    hits = json.loads(response.read())
                for hit in hits:
                    title = hit.get("title", "")
                    if IRRELEVANT.search(title.lower()):
                        continue
                    detail = get(f"https://api.figshare.com/v2/articles/{hit['id']}")
                    text = (title + " " + detail.get("description", "")).lower()
                    if not IMAGEY.search(text):
                        continue
                    size = sum(f.get("size", 0) for f in detail.get("files", []))
                    if size < 20e6:
                        continue
                    add(area, "Figshare", title[:90], hit.get("url_public_html", ""),
                        (detail.get("license") or {}).get("name", ""), f"{size / 1e9:.1f} GB", term)
                time.sleep(0.5)
            except Exception as error:
                print("  Figshare", term, error)


def kaggle():
    if not (os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY")):
        print("  Kaggle skipped (add KAGGLE_USERNAME and KAGGLE_KEY to Colab Secrets to include it)")
        return
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    for area, terms in TOPICS.items():
        for term in terms:
            try:
                for d in api.dataset_list(search=term, file_type="all")[:20]:
                    add(area, "Kaggle", d.ref, f"https://www.kaggle.com/datasets/{d.ref}",
                        getattr(d, "licenseName", "") or "", getattr(d, "totalBytes", "") or "", d.title)
            except Exception as error:
                print("  Kaggle", term, error)


# Roboflow projects found by hand; the scout checks each one's licence and size with your key.
ROBOFLOW = {
    "hair": ["scalpdet/scalp-data-iqjst", "scalpdet/dandruff-big-chunks", "husnas-workspace/head-lice-ai",
             "nayab-waris-hfzbj/hair-and-scalp-disease", "nayab-waris-hfzbj/hair_and_scalp_disease",
             "rooted/hair-loss-nq8hh-tqveb", "sreenithi/hairproblems-detection", "itclab/hair-detection-lkule",
             "project-teqqx/hair-disease-detection", "major-project-s3rff/hair-disease-detection-o2ok0",
             "inferenz/hair-and-bald"],
    "nails": ["vincent-y20l1/upper-body-fingernail", "nsu-sxhmy/nails-semantic-segmentation",
              "linkerverse-xzpl7/nail_instance_segmentation", "fatima-wmkf6/nail-segmentation-jrprm",
              "rizqi-oleec/nail-segmenter", "nailproject-padk9/nail_segmentation"],
}


def roboflow():
    key = os.environ.get("ROBOFLOW_API_KEY")
    if not key:
        print("  Roboflow skipped (no ROBOFLOW_API_KEY)")
        return
    for area, projects in ROBOFLOW.items():
        for slug in projects:
            try:
                data = get(f"https://api.roboflow.com/{slug}?api_key={key}")
                project = data.get("project", {})
                add(area, "Roboflow", slug, f"https://universe.roboflow.com/{slug}", project.get("license", ""),
                    f"{project.get('images', '')} images", ", ".join((project.get("classes") or {}).keys())[:160])
            except Exception as error:
                add(area, "Roboflow", slug, f"https://universe.roboflow.com/{slug}", "", "", f"not reachable: {error}")


if __name__ == "__main__":
    for name, step in [("Hugging Face", huggingface), ("Zenodo", zenodo), ("Figshare", figshare),
                       ("Wikimedia Commons", wikimedia), ("Kaggle", kaggle), ("Roboflow", roboflow)]:
        print("Searching", name, flush=True)
        step()
    order = {"ok": 0, "share-alike": 1, "unknown": 2, "no": 3}
    rows = sorted(finds.values(), key=lambda r: (order[r["verdict"]], r["area"], r["source"], r["name"]))
    with open("scout_report.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else ["area"])
        writer.writeheader()
        writer.writerows(rows)
    json.dump(rows, open("scout_report.json", "w"), indent=1)
    for v in order:
        print(f"{v:12s}", sum(r["verdict"] == v for r in rows))
    print("Top commercial-use finds:")
    for r in [r for r in rows if r["verdict"] == "ok"][:40]:
        print(f"  [{r['area']}] {r['source']}: {r['name']} ({r['licence']}, {r['size']})")
