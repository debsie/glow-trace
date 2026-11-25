# Glowtrace vision models

`multitask.py` trains one small U-Net per area (skin, nails, hair) that outputs a map for every
indicator. Labels come from physics and optics: known amounts of haemoglobin, melanin, surface
shine, fine texture, nail staining, white spots and ridges are added to real base photos under
random light and camera conditions (see the docstring). The redness-only predecessors are in
`research/redness/`.

Run on a GPU with `train_vision_models.ipynb` (Colab: upload the notebook, T4 GPU, run cells).
Locally: `python3 multitask.py skin`, or `python3 multitask.py nails --images DIR`.

## Base photos

- Skin: Google SCIN (SCIN Data Use License, commercial use read as allowed, no re-identification),
  downloaded automatically.
- Nails and hair: a folder of photos from datasets whose licence allows commercial use. Candidates
  found (licences read from search results only, confirm on each page while signed in, and check
  the uploader credits their sources):
  - Nails: Roboflow "Nails semantic segmentation" (nsu-sxhmy, CC BY 4.0), "nails_segmentation"
    (personal-projects-jfbag, CC BY 4.0), "Nails Segmentation" (sergei-artiukhin, MIT),
    "nail_segmentation" (nailproject-padk9, CC BY 4.0).
  - Hair: Roboflow "hair_baldness" (CC BY 4.0), "hloss_segment_topView_1class" (CC BY 4.0).
  - Excluded as non-commercial: CelebAMask-HQ, LaPa, Figaro-1k (unconfirmed), CelebHair, the
    TrainingDataPro/UniqueData hair sets (CC BY-NC-ND).
    CC BY 4.0 requires attribution: record each dataset used in `docs/calibration-plan.md`.

## Shipping rule

A model ships only if, on held-out photos, each head tracks its true amount (correlation), stays
quiet when its effect is absent (noise and leak from other effects), and passes the app's
robustness tests. Skin redness must also beat the shipped redness model.

Skin texture (v5 onwards) must also pass two real-photo gates:

1. `real_photo_checks` in the training eval (held-out real patches, no simulated effects): a blur
   lowers the reading by at least 70% of what it does to the measured fine detail of the same patches
   (`blur_share_of_ideal >= 0.7`; v5 and v6 asked for `blur <= -0.5`, which even the measured detail
   itself misses at about -0.49), and +/-20%
   exposure moves it by at most a fifth (`brightness <= 0.2`).
2. `real_photo_gate.cjs` on this machine, through the app's own face finder, with consented photos
   of at least two people: the same blur and brightness checks, and repeat photos of one person
   within half the spread between people. Photos stay on the machine and out of the repo.

## v5: skin texture on patches

v4's texture head scored r = 0.81 on simulated roughness yet barely moved on real faces (heavy
grain +0.001, blur -0.014, two people 0.05 apart), because it learnt the simulated speckle at the
shrunk-photo scale. `--patches` (`train_glowtrace_v5_kaggle.ipynb`) changes four things:

- Close-up 128 px skin patches at a random scale (short side 256-640 px), three per photo.
- Realistic surface change: pores (soft dark dots), side-lit bumps, fine roughness, and beauty
  filter smoothing on 30% of photos, plus phone processing (resampling, sharpening, JPEG).
- The texture label is measured: the change in fine-scale relative contrast (`hp_contrast`), so
  smoothing gives a negative label and every effect shares one unit.
- An anchor term (a single photo's reading tracks its own fine contrast) and a ranking term (every
  clear change points the right way), so readings mean something on one photo, not only as changes.

## Labelling rounds

Each round of "which is smoother" answers has its own `label_patches*.npz` (set id = hash of the
pixels) and answer files; training reads every round in the `--labels` folder and joins answers to
their own round by set id. Round 1: 457 Google SCIN close-ups (many show rashes, so 44% were "can't
tell"). Round 2: face skin from Unsplash Lite portraits and the consented team photos, cut by the
app's own face guide and `skinPatches` (wide shots cropped around the face first), sorted into ITA
bands, with dark patches shown brighter on the page only (`--lift`).

## Datasets added 2026-11-24 (licences checked at the source)

- **Skin and fingernails, Yakimov et al. 2024** (figshare 25867432, CC0): 252 hand photos of bare
  nails. Boxes are `[top, left, bottom, right]` on the photo as stored (EXIF rotation not applied);
  cut into 750 nail tiles with a 15% margin. Verified by eye on a contact sheet.
- **Open Images V7 validation, "Human hair" boxes**: images CC BY 2.0 only (per-image licence
  checked), annotations CC BY 4.0; per-image author and source in `attribution.csv`. Open Images
  has no hair, face or head masks (not among its 350 segmentation classes), so hair areas come
  from the hair guide like every other hair photo.
- **Not used:** LaPa (non-commercial licence), Fitzpatrick17k (CC BY-NC-SA 3.0), the Kaggle
  "skintone-dataset" (licence not confirmed).

## Labelling round 3: redness on FairFace, weighted to deep skin

Round 2's redness answers agreed with the app on only 67% of deep-skin pairs, and the labeller
skipped half of them: the deep-skin patches were often dim. Round 3 (set `9cf2b47d7174bbc5`):

1. 120 FairFace faces per group (CC BY 4.0, Hugging Face parquet, 0.25 padding), kept out of
   the repo.
2. `face_patches.cjs`: one patch per face through the app's own face guide, the 20% square
   with a 4% margin that is 98% or more skin, enlarged to 128 px (646 of 840 faces).
3. `pick_patches.py`: well lit, little clipping, no strong edges; 45 / 41 / 75 / 75 by band.
4. `make_label_page.py --from-folder`, then `make_label_page.py ... --attribute redness`.

## Roboflow "skin tone" dataset (aman-x15w6): owner's decision

Listed as CC BY 4.0, but the page names no source for its 2,100 images and no consent; samples
look like stock or editorial photos. The owner chose to use it for its side and three-quarter
profiles. Use is limited to local testing of the face guide on unusual angles: no training, no
images or weights from it in the app or the repo. Revisit if the source is found.

## Lighting-challenge analysis (`lighting_sets.cjs`)

Turns lighting-challenge photos into release checks 2, 3 and 5 for every skin reading, through the
app's own pipeline, on this machine only:

1. Export the rows: in the Supabase SQL editor, run
   `select path, set_id, lighting from training_photos where set_id is not null order by created_at;`
   and download the result as JSON.
2. Download the matching files from the `training-photos` storage bucket into a local folder, and
   add each local file name to its row as `"file"` (the owner does this; photos never go in the repo).
3. With the dev server on 127.0.0.1:8091: `node research/vision/lighting_sets.cjs manifest.json`.

It reports, per reading: `light` (range across daylight, indoor and dim within one set), `floor`
(measured noise floor, 2 x the standard deviation of same-person, same-light repeats), the
`current` floor the trend uses, and both by skin-tone band, plus `coverage` (people per band; the
bar wants 5 each). A set is one person in three lights, so same-light repeats need a person to do
the challenge twice, a few minutes apart: ask testers to.
