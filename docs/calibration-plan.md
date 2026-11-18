# Calibration plan

The kernel (`src/lib/cv/`) turns pixels into 0-100 indicators with fixed formulas. Nothing yet
proves those numbers match what is on the skin. This plan builds that evidence with free
sources, in the order that costs least.

## What we claim, and what we do not

- **Claim:** the same skin in similar light reads about the same (repeatability), and a real
  change moves the reading in the right direction.
- **Do not claim:** clinical accuracy, diagnosis, or that a score equals a measured quantity.
- **Hydration** cannot be read reliably from a photo and cannot be rated by eye. Until it is
  checked against a device reading, treat it as "how dry or supple the skin looks".

## Sources, free first

| Source                    | Gives                                                     | Status                                                                      |
| ------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Synthetic stress tests    | Stability under light, white balance, blur                | Built: `robustness.test.ts`                                                 |
| Numbers-only contribution | Scores plus the person's own 1-5 rating, light, skin type | Built: scan result card, `calibration_samples` table                        |
| Repeat-photo pairs        | Test-retest spread on real phones and skin tones          | Built: "repeat of my last photo" option                                     |
| Admin report              | Coverage, agreement, repeatability                        | Built: Beta dashboard, Calibration tab                                      |
| Lay-rater comparisons     | "Which is redder" votes from 10+ people per pair          | Not built. Needs photo upload, separate consent and a privacy-policy change |
| University partner        | Expert labels, ethics approval                            | Outreach, after there is data to show                                       |
| Open datasets             | Skin-tone coverage                                        | See below                                                                   |

## What the contribution flow sends

Only: the kernel version, area, indicator scores, the person's 1-5 ratings, the light they chose,
photo sharpness, whether the colour-cast warning showed, an optional self-assessed Fitzpatrick
type, and the id of an earlier contribution if this is a repeat. Never the photo, a name or an
email in the row. Rows belong to the account: deleting the account or using "Delete what I
shared" on the Your Data page removes them. At most 40 per person per day.

## Reading the admin report

- **Agreement** is a rank correlation between the app's score and what people say they see.
  Self-ratings are rough, so only a clearly positive number from 30+ people means anything. A
  near-zero or negative number on an indicator is a reason to change that formula (bump
  `KERNEL_VERSION`, update `docs/cv-kernel-spec.md`).
- **Repeatability** is how far an indicator moves between a photo and its repeat. If a
  indicator's 90th-percentile spread is larger than the change we call "improving" or
  "worsening", raise that indicator's noise floor (`NOISE_BY_CONCERN` in `agent.ts`).
- **Coverage** shows which skin types and lights are missing. Recruit there before reading
  anything else.

## Targets before any accuracy wording

- 30+ contributions per indicator, with every Fitzpatrick type I-VI represented.
- 20+ repeat pairs in at least three different lights.
- No indicator whose agreement differs by more than 0.2 between skin-type groups.

## Open datasets (use only for skin-tone coverage and stability checks)

Check each licence before downloading. Do not train on, redistribute or ship any of them.
Most skin datasets are for disease images and carry non-commercial terms, and none label redness
or hydration. Candidates to review: Google's SCIN (consumer-contributed photos with
self-reported and dermatologist-estimated skin type), Fitzpatrick17k, PAD-UFES-20. Record the
licence and our decision here before use.

| Dataset             | Licence checked on | Allowed use | Decision |
| ------------------- | ------------------ | ----------- | -------- |
| (none reviewed yet) |                    |             |          |

## Recruiting

Offer free months through the existing referral rewards (`referrals.ts`) for completing
contributions. Aim for an even spread across skin types, not just a large number. Say plainly
what is shared (numbers only) and that it can be deleted.
