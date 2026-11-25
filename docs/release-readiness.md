# Release readiness: when Glowtrace's analysis is good enough to charge for

Glowtrace stays in a free beta until every indicator shown to paying members passes the bar below.
An indicator that can't pass is either hidden or clearly marked "preview" (not counted in scores or
trends) at launch; it never holds up launch silently, and it never ships quietly below the bar.

Claims stay as in `calibration-plan.md`: repeatability and direction of change, never clinical
accuracy.

## The bar

Every indicator shown with a number must pass all that apply:

1. **Tracks what it says it tracks.** Trained models: r >= 0.7 against the known amount on held-out
   photos, and r within 0.1 across all four skin-tone (ITA) bands. Formulas: a documented,
   tested response in the right direction.
2. **Ignores the photo, not the skin.** On real photos through the app's own pipeline
   (`research/vision/real_photo_gate.cjs` or its equivalent for the indicator): +/-20% exposure
   moves the reading by at most 0.2 of the spread between people; a white-balance shift likewise
   for colour readings; texture-type readings drop with blur by at least 70% of what blur does to
   the measured signal.
3. **Steady on the same person.** Repeat photos minutes apart vary no more than 1.3x as much as the
   photos' own measured signal, and less than the change the trend reports as real (the noise
   floor in `NOISE_BY_CONCERN`).
4. **Agrees with a trained eye** where human answers exist: at least 70% of held-out clear pairs.
5. **Fair.** Checks 2-4 hold on photos from every skin-tone band, with at least 5 people per band
   in the real-photo set.

## Where each indicator stands (2026-11-25)

| Indicator                                      | Source                                                | 1 Tracks                                           | 2 Ignores photo                                                                       | 3 Steady                                                | 4 Trained eye                         | 5 Fair                | Verdict                              |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- | --------------------- | ------------------------------------ |
| Skin texture                                   | v7 + v8 models, averaged (kernel v2.10)               | Pass (0.89 / 0.91, bands 0.87-0.93)                | Pass (blur 105%, exposure 0.07)                                                       | Pass (1.32 of 1.6)                                      | **69%, just short**                   | **Not yet: 3 people** | Close                                |
| Redness                                        | skin a*, evened across tones, light-corrected (v2.12) | Equal blood within 1.5 points across tones         | **Pass (exposure 3.1, colour 2.9 of 8)**                                              | **22.2 of 16, fails (3 people)**                        | **Pass: 78% (118 of 152)**            | Not yet               | Close: steadiness on repeat photos   |
| Pigment, even tone, dark circles, nose redness | formulas, light-corrected (v2.11)                     | Documented                                         | Nose redness passes; dark circles exposure 2.3 of 2 (was 6.4, v2.13); even tone fails | Nose redness and dark circles pass; even tone 10.1 of 4 | No labels                             | Not yet               | Nose redness close; others need work |
| Hydration, skin type, shine                    | formulas, provisional                                 | Documented                                         | Not run                                                                               | Not run                                                 | No labels                             | Not yet               | Preview at launch unless checked     |
| Hair texture                                   | trained model (0.93)                                  | Pass on simulation                                 | Calibrated on 9 photos, gate not run                                                  | Not run                                                 | No labels                             | Not yet               | Needs real-photo checks              |
| Hair length                                    | pose + hair mask (v2.9)                               | About 6 in 10 right on wild photos                 | n/a                                                                                   | n/a                                                     | **The person confirms every reading** | n/a                   | Shippable as "you confirm"           |
| Nail yellowing                                 | trained model (0.78)                                  | Pass on simulation                                 | Not run                                                                               | Not run                                                 | No labels                             | Not yet               | Needs real-photo checks              |
| Nail spots, ridges                             | formulas                                              | Documented                                         | Not run                                                                               | Not run                                                 | No labels                             | Not yet               | Preview at launch unless checked     |
| Polish check (gate)                            | colour rule (v2.8)                                    | 1 in 750 false alarms; colours caught; nude missed | n/a                                                                                   | n/a                                                     | n/a                                   | Tested on many tones  | Shippable                            |

## Skin-tone bands (ITA): redness against the labeller, kernel v2.12

| Band         | Patches | Clear pairs | Agrees       |
| ------------ | ------- | ----------- | ------------ |
| 0 (lightest) | 79      | 28          | 24 (86%)     |
| 1            | 22      | 39          | 37 (95%)     |
| 2            | 32      | 27          | 20 (74%)     |
| 3 (deepest)  | 101     | 42          | **28 (67%)** |

Deep skin is under the bar, and the labeller skipped half its pairs. Tuning the tone term (powers 0
to 1.5) moves band 3 only between 27 and 30 of 42, so the limit is the evidence, not the formula:
the public deep-skin patches are often dim or low contrast. Fix: a deep-skin labelling round from
well-lit selfies (lighting challenge, bands 2 and 3 first), ideally with a second labeller who
works with deep skin every day. ITA bands describe skin colour, not origin: North African and
Middle Eastern skin falls mostly in bands 1-2, sub-Saharan skin mostly in bands 2-3, and every
group spans more than one band.

## What's left, in order

1. **More real people for the real-photo set**: at least 5 per skin-tone band, each with three
   selfies minutes apart (the lighting challenge collects exactly this). Unblocks check 5 for
   everything and makes check 3 trustworthy.
2. **A real-photo gate for every indicator**, not just texture: the same three checks (exposure,
   white balance or blur, same person) through the app's pipeline. Most formula indicators may
   already pass; we don't know until we run it.
3. **Skin texture to 70% agreement**: v9 trains longer on the labeller's answers while keeping the
   steadiness that made v7 pass; a third labelling round on shared beta selfies.
4. **Labels for redness and pigment** (a labelling round like texture's: "which looks redder"), so
   check 4 exists for the readings people care about most.
5. **Nail and hair retraining** with the new CC0 nail tiles and Open Images hair photos, then
   their real-photo gates.

When every row reads Pass (or is marked preview), the analysis is ready to charge for.
