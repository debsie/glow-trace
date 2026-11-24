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
