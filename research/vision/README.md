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
