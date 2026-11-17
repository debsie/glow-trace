# Glowtrace product plan: powerful, and private by design

Status: Phase 1 is built (analysis engine, `src/lib/cv/`). Phase 2 is built: on-device saving, download and delete, an installable app that works offline, and progress charts with before/after comparison. Phases 3 to 6 are proposals.

## The principle

Glowtrace's advantage is that it can be the beauty app that never needs your photos. Every
decision below follows one rule: **the photo stays on the device; only what the user chooses
to share leaves it.** That is what makes the product trustworthy, and it is also the cheapest
way to comply with privacy law in every market, because data we never collect cannot be
breached, subpoenaed or mishandled.

## Where we are today

| Area                  | State                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Scan scores           | Computed from the photo on the device (MojoCV v1.1). Calibrated on three sample photos only.                                                |
| Accounts              | None. One demo profile.                                                                                                                     |
| Data storage          | Scans, photos, shelf, clients and lookbooks in the browser's IndexedDB; plan and usage in local storage. Download and delete on `/privacy`. |
| Payments              | None. Anyone can switch plan on their own device.                                                                                           |
| Referral and partners | Codes and links only. No tracking, rewards or payouts.                                                                                      |
| Legal pages           | None published. Drafts are in `docs/legal/`.                                                                                                |

## Phase 1: make the core claim true (the analysis engine)

Build the on-device analysis kernel already specified in `docs/cv-kernel-spec.md`.

- Real scores computed from the pixels of the photo, in the browser, deterministic.
- Photo-quality check ("too dark, retake") before scoring.
- Until this ships, the landing page's claims about pixel-based scoring are not true and the
  site should not be promoted.

Why first: everything else is built on scan results people can trust.

## Phase 2: keep what the user creates (local-first storage)

- Store scans, shelf, routines and settings in the browser database (IndexedDB), so history
  survives a reload and the app works offline.
- Installable app (PWA) with offline support.
- "Export my data" and "Delete everything" buttons from day one. These are legal rights in
  the EU, South Africa, Australia and several US states, and they are trivial to honour
  when the data is on the user's own device.
- Progress view: score trends over weeks, side-by-side photo comparison.

No server is needed for this phase, so there is no new privacy exposure.

## Phase 3: accounts and sync, without seeing the data

- Sign-in by email link or passkey. No passwords to leak.
- Optional sync across devices, **end-to-end encrypted**: data is encrypted on the device
  with a key the server never has. The server stores ciphertext only.
- Photos do not sync by default. If a user turns photo backup on, photos are encrypted the
  same way.
- Server database with row-level security so one account can never read another's rows.
- Host user data in a region that suits the main market and the law (see "Where data lives").

Trade-off to decide: end-to-end encryption means we cannot recover data if a user loses
every device and their recovery key. The alternative (server-readable data) is simpler but
makes us a holder of sensitive personal data, with everything that brings.

## Phase 4: payments and real entitlements

- A South African payment provider for card and instant EFT in rands (for example Paystack,
  PayFast or Yoco). Card details never touch our servers.
- The plan a user is on is decided by the server after a verified payment event, not by the
  device. This closes the current loophole.
- Clear renewal terms, a reminder before yearly renewals, and cancellation in two taps.
  Auto-renewal rules in the US, EU, South Africa and Australia all require this.

## Phase 5: the features that make it powerful

Each one is designed so the photo still never leaves the device.

| Feature                      | How it stays private                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingredient conflict checks   | A rules list shipped inside the app. Runs on the device.                                                                                              |
| Routine Coach                | Opt-in. Sends scores and shelf product names only, never photos or identity. Provider contractually barred from training on it. Capped at 10 a month. |
| Reminders and streaks        | Local notifications. No tracking server.                                                                                                              |
| Product lookup by barcode    | Looks up a product code, which says nothing about the person.                                                                                         |
| MUA guest links and sign-off | The client opens a link with a one-time code. They see only their lookbook.                                                                           |
| 7-day pre-event prep planner | Generated on the artist's device from the client's scores.                                                                                            |
| Client photo storage         | Encrypted on the artist's device before upload. Client consent recorded first.                                                                        |
| PDF client briefs            | Generated on the device.                                                                                                                              |

## Phase 6: referral and partner programmes for real

- Server-side attribution of invite and partner links, tied to verified payments.
- Fraud controls: no self-referral, one reward per paying household card, rewards held until
  the refund window closes.
- Partner payouts by EFT with tax details collected, and a required "I earn commission"
  disclosure for partners (advertising rules in all four regions require it).

## Privacy and compliance work that runs alongside

1. **Consent, plainly asked.** Before the first scan: what is analysed, that it stays on the
   device, and that results are wellness indicators. Separate, explicit opt-in for anything
   that leaves the device (sync, Coach, photo backup).
2. **Age.** Adults only (18+) at launch. This avoids children's privacy law (COPPA in the
   US, parental consent rules in the EU and South Africa) until we choose to support minors.
3. **Artists hold their clients' data.** Under MUA Studio the artist decides what client
   data to keep, so the artist is the responsible party and Glowtrace is their service
   provider. That needs a data processing agreement in the terms, and a client consent step
   in the app.
4. **No third-party advertising or tracking.** No ad pixels, no data sales. This removes
   most US state privacy-law obligations and the EU cookie banner.
5. **Wording.** Glowtrace must not present itself as diagnosing or treating conditions, or
   regulators can treat it as a medical device (FDA in the US, the MDR in the EU, SAHPRA in
   South Africa, the TGA in Australia). See the open question on "Diagnostic Scan" below.
6. **Organisational basics.** Register an Information Officer with South Africa's
   Information Regulator; appoint an EU representative if we target EU users without an EU
   establishment; keep a record of processing; write a breach response plan (notification
   deadlines: 72 hours in the EU, "as soon as reasonably possible" in South Africa, 30 days
   to assess in Australia); run a data protection impact assessment before Phase 3.
7. **Security.** Encryption in transit and at rest, least-privilege access, dependency and
   secret scanning in CI, and an external penetration test before payments go live.

## Where data lives

Recommended: host in the EU (or in South Africa if a suitable provider is used). EU hosting
satisfies the GDPR directly, and South African, Australian and US law all permit transfers
there with ordinary safeguards. End-to-end encryption makes the location matter far less.

## Open questions for the owner

1. **Product wording.** The design uses "Diagnostic Scan", "diagnostics" and "lab report".
   These words increase the risk of being treated as a medical device. Options: keep them
   with strong disclaimers (higher risk), or rename to "Skin Scan" / "wellness check"
   (lower risk). A lawyer should confirm.
2. **End-to-end encryption** for sync: accept unrecoverable data in exchange for the
   strongest privacy position?
3. **Launch markets.** South Africa only at first, or all four regions at once? Selling in
   the EU from day one adds the EU representative and VAT registration.
4. **Minimum age.** Confirm 18+.
5. **Company details** needed to finish the legal pages: registered company name and
   number, address, contact email, and who the Information Officer will be.
