# Indicator map

Every reading Glowtrace aims to give, for its core user: adult women in South Africa, every skin
tone and hair type. Each has a status and the source of its signal. Everything is a wellness
indicator, never a diagnosis. Kept in one place so that new indicators are planned, not added as
afterthoughts.

Status: **live**, **build** (no training needed: masks, guides and models we already have),
**train-sim** (physics-simulated training, `train_glowtrace_v4.ipynb`), **train-label** (real
labelled photos, `train_glowtrace_labels.ipynb`), **own-data** (needs a consented Glowtrace photo
study), **context** (asked, not measured).

## Skin

| Indicator                                    | Status                    | Signal                                                |
| -------------------------------------------- | ------------------------- | ----------------------------------------------------- |
| Redness, overall                             | live                      | trained redness model (v2)                            |
| Redness by zone (forehead, cheeks, chin)     | live                      | face zones                                            |
| Redness on the nose                          | build                     | nose zone from face landmarks                         |
| Dark circles                                 | build, then train-sim     | under-eye vs own cheek brightness (fair across tones) |
| Pigmentation, melasma, dark spots            | live (formula), train-sim | pigment map, by zone                                  |
| Even tone                                    | live                      | hue variance                                          |
| Breakouts (count and where)                  | train-sim, train-label    | acne datasets (CC BY)                                 |
| Texture and pores                            | live (formula), train-sim |                                                       |
| Shine and skin type (oily, combination, dry) | build                     | T-zone shine vs cheek shine                           |
| Ashy skin (grey dry cast on deeper tones)    | build                     | lightness up and colour down vs own baseline          |
| Dryness and flaking                          | train-sim                 |                                                       |
| Fine lines (forehead, eyes)                  | train-label               | wrinkle datasets (CC BY)                              |
| Lips dryness                                 | build                     | texture inside the lips outline                       |
| Makeup and your skin                         | build                     | readings after Makeup Day vs bare days                |
| Makeup left on overnight                     | context                   | Makeup Day removal check-in                           |
| Under-eye puffiness                          | own-data                  | needs depth or side light                             |
| Sun exposure effect                          | build                     | pigment trend with sunscreen use from the routine     |
| Shade and undertone                          | live                      | ITA and hue angle                                     |

## Hair

| Indicator                                  | Status                    | Signal                                            |
| ------------------------------------------ | ------------------------- | ------------------------------------------------- |
| Length band (ear to hip, APL, BSL)         | build                     | pose landmarks + hair mask, length photo          |
| Growth and length retention                | build                     | trend of length over time                         |
| Stretched or natural (shrinkage)           | context                   | asked with each length photo; only like with like |
| Hair today (out, braids, wig, weave, locs) | context, then train-label | pauses hair readings during protective styles     |
| Curl pattern (1A to 4C)                    | train-label               | curl-type datasets                                |
| Texture and porosity                       | live                      | trained hair model                                |
| Shine                                      | train-sim                 | v4 hair-fine model                                |
| Frizz                                      | train-sim                 |                                                   |
| Ends and breakage                          | own-data                  | no usable public dataset yet                      |
| Crown thinning (visible scalp)             | build                     | hair mask share in the crown photo                |
| Edges and hairline (traction)              | build, then own-data      | hairline position vs face landmarks over time     |
| Grey share                                 | build                     | light, low-colour hair pixels                     |
| Scalp flakes                               | train-sim, train-label    | ScalpHairLabels, dandruff sets                    |
| Scalp oiliness and dryness                 | train-label               | scalp datasets with oily and dry labels           |
| Treatments (relaxer, colour, heat)         | context                   | logged, explains jumps in the trend               |

## Nails

| Indicator                        | Status                  | Signal                                          |
| -------------------------------- | ----------------------- | ----------------------------------------------- |
| Yellowing                        | live                    | trained nails model                             |
| Spots, ridges, cuticles          | train-sim               | v4 nails models                                 |
| Polish or nail art               | build, then train-label | colour and gloss check; painted vs bare dataset |
| Nail length                      | build                   | tip past the fingertip from hand landmarks      |
| Peeling and breakage             | own-data                |                                                 |
| After acrylics or gel (thinning) | context                 | logged, readings compared before and after      |

## Context (asked, stays on the device)

Cycle (opt-in), pregnancy (flags retinoids and high-dose acids in the ingredient check),
climate (humidity and UV, a future weather lookup), sleep and stress check-ins. Health-adjacent
context needs the owner's sign-off and a privacy policy update before it ships.
