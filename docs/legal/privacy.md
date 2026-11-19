# Glowtrace Privacy Policy

> **DRAFT — not published, not legal advice.** To be reviewed and finalised by a qualified
> privacy lawyer. Items in [SQUARE BRACKETS] must be completed. This policy describes the
> intended product (accounts, optional sync, payments, Routine Coach). **A privacy policy
> must describe what the software actually does**, so each section must be checked against
> the built product before publication, and updated whenever a data flow changes.

Last updated: [DATE]

## The short version

- Your photos are analysed **on your device**. We do not upload them unless you switch on a
  feature that clearly says it does.
- We collect as little as we can: an email address to sign you in, your plan, and payment
  status.
- We do not sell your information or share it for advertising. We use photos to train
  models only if you turn on "Help train Glowtrace" and then choose to share a specific photo.
- You can see, export, correct and delete your information at any time.
- Glowtrace is for adults (18+).

## 1. Who is responsible for your information

[COMPANY LEGAL NAME] ("Glowtrace", "we"), [REGISTERED ADDRESS], South Africa, is the
responsible party (South Africa) and controller (EU and UK) for the information described
here.

- Information Officer (South Africa): [NAME], [EMAIL]
- EU representative under Article 27 GDPR: [NAME AND ADDRESS, if required]
- UK representative: [NAME AND ADDRESS, if required]
- Privacy contact for everyone: [PRIVACY EMAIL]

**If a makeup artist uses Glowtrace for you as their client**, the artist decides what
information about you is kept and is responsible for it. We process it on their behalf.
Contact your artist first; we will help them respond.

## 2. What we collect, and what stays on your device

| Information                                                                                                                                                                        | Where it lives                                                                                          | Why                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Photos you scan                                                                                                                                                                    | **Your device only**, unless you turn on encrypted photo backup                                         | To compute your indicators                                        |
| Indicators and scores, shelf, routines, notes                                                                                                                                      | Your device. If you turn on sync: our servers, encrypted with a key we do not hold [CONFIRM once built] | To show your results and history                                  |
| Email address                                                                                                                                                                      | Our servers                                                                                             | To sign you in and send service messages                          |
| Plan, billing status, invoices                                                                                                                                                     | Our servers and our payment provider                                                                    | To provide and bill your plan                                     |
| Card or bank details                                                                                                                                                               | **The payment provider only.** We never see full card numbers                                           | To take payment                                                   |
| Invite and partner codes used, and resulting rewards                                                                                                                               | Our servers                                                                                             | To run the referral and partner programmes                        |
| Partner banking and tax details                                                                                                                                                    | Our servers                                                                                             | To pay commission and meet tax law                                |
| Routine Coach questions, with your scores and product names                                                                                                                        | Sent to our AI provider only when you ask the Coach a question                                          | To answer you                                                     |
| Numbers you choose to share to test the analysis: scores, your 1 to 5 ratings, the light you chose, photo sharpness, and optionally your self-assessed skin type (never the photo) | Our servers                                                                                             | To check that the analysis is accurate and fair across skin tones |
| Basic technical data: device type, app version, error reports, IP address                                                                                                          | Our servers, short retention                                                                            | Security and fixing faults                                        |
| Client details kept by an artist (name, contact, skin notes, scores, lookbooks)                                                                                                    | The artist's account                                                                                    | For the artist's work with that client                            |

We do **not** collect: precise location, contacts, advertising identifiers, or face
templates that identify you. We do not use face recognition. If you turn on the optional face
guide, it finds the outline of your face, eyes and lips on your device only, so the analysis can
read your skin without the background; those points are used for that one scan and never stored
or sent anywhere.

If you scan a product label in the ingredient check, the text is read on your device by a reader
we serve from our own site. The label photo and its text are not uploaded or stored. If you scan a barcode instead, the
barcode is read on your device and only its number is sent to Open Beauty Facts, an open product
database, to look up the ingredients. No photo, reading or account detail goes with it, and
Glowtrace sends no cookies or referrer with the request.

### Sensitive information

Information about your skin, hair and nails can reveal things about your health, and photos
of your face are personal. Many laws treat this as sensitive (special personal information
under POPIA, special category data under the GDPR, sensitive information under the
Australian Privacy Act, consumer health data under laws such as Washington's My Health My
Data Act). We handle it as sensitive everywhere:

- it is processed on your device by default;
- anything that would send it to us needs your **separate, explicit opt-in**, which you can
  withdraw at any time in [Settings → Privacy];
- we never use it for advertising, never sell it, and never share it except with the
  service providers listed in section 5 when you use the feature that needs them.

### Optional: photos you choose to share for training

If you turn on "Help train Glowtrace" (Privacy page; separate from beta access and never
required), you can share individual scan photos after a scan. For each one we keep a new JPEG
copy without location or camera details, the scan's readings, the area and the analysis version,
in a private Supabase storage bucket in the United Kingdom (London). Only the Glowtrace team can
see them. We use them only to train and test Glowtrace's analysis. They are kept for 2 years at
most. Withdrawing deletes every photo you shared; deleting your account does too. Our legal basis
is your explicit consent, which you can withdraw at any time.

## 3. Why we use your information, and our legal grounds

| Purpose                                                                     | Legal ground (GDPR / POPIA)                       |
| --------------------------------------------------------------------------- | ------------------------------------------------- |
| Provide the app, your account and your plan                                 | Performance of our contract with you              |
| Sync, photo backup, Routine Coach, anything involving sensitive information | Your explicit consent                             |
| Sharing scores and ratings to test the analysis                             | Your explicit consent, given each time you share  |
| Take payment, keep invoices, pay partners                                   | Contract; legal obligation (tax and accounting)   |
| Keep the service secure, prevent fraud and abuse                            | Legitimate interests                              |
| Service emails (receipts, renewal reminders, changes to terms)              | Contract; legal obligation                        |
| Marketing emails                                                            | Your consent (opt-in). Unsubscribe in every email |

We do not make decisions about you by automated means that have legal or similarly
significant effects.

## 4. Cookies and tracking

Glowtrace sets no cookies. It uses only the browser storage needed to keep you signed in, keep
your scans on your device and let the app work offline; the full list is on the Cookies and
storage page (`/cookies`). Fonts and all other files are served by Glowtrace itself, so no third
party receives your IP address when you visit. We do not use advertising cookies, tracking
pixels or cross-site tracking. If that ever
changes, we will ask for your consent first where the law requires it. We honour Global
Privacy Control signals.

## 5. Who we share information with

We share information only with service providers who act on our instructions under
contract:

| Provider           | Purpose                                                                                                                                                       | Location                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Supabase Inc.      | Sign-in, account, beta access and feedback database                                                                                                           | United Kingdom (London) |
| Vercel Inc.        | Website hosting; does not store personal information                                                                                                          | [CONFIRM REGION]        |
| Cloudflare, Inc.   | Bot check (Turnstile) on the sign-in page; sees your IP address and browser signals                                                                           | Global network          |
| [PAYMENT PROVIDER] | Payments                                                                                                                                                      | [REGION]                |
| Supabase Inc.      | Sign-in link emails (until a dedicated email provider is added)                                                                                               | United Kingdom (London) |
| Anthropic, PBC     | Written coach for signed-in members (Claude Haiku): your question, scores, trends and shelf product names. Never photos. Anthropic does not train on API data | United States           |

We may also disclose information when the law requires it, or to a successor if the
business is sold, on the condition that this policy continues to apply. We do **not** sell
personal information, and we do not share it for cross-context behavioural advertising.

## 6. Transfers between countries

Our providers may process information outside your country. When they do, we protect it
with the safeguards the law requires: for South Africa, section 72 of POPIA; for the EU
and UK, adequacy decisions or Standard Contractual Clauses; for Australia, reasonable
steps under Australian Privacy Principle 8.

## 7. How long we keep information

| Information                             | Kept for                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Data on your device                     | Until you delete it or remove the app                                                                                  |
| Account and synced data                 | Until you delete your account, then removed within 30 days                                                             |
| Billing and tax records                 | 5 years, as South African tax and company law requires [CONFIRM]                                                       |
| Photos you chose to share for training  | Until you withdraw or delete your account, and 2 years at most                                                         |
| Written coach questions                 | Not stored by Glowtrace. We count questions per day only. Anthropic's own API retention applies [CONFIRM current term] |
| Error and security logs                 | Up to 90 days                                                                                                          |
| Numbers you shared to test the analysis | Until you delete them on the Your Data page or delete your account                                                     |
| Artist client records                   | Until the artist deletes the client or closes their account                                                            |

## 8. How we protect it

On-device analysis; encryption in transit and at rest; end-to-end encryption for synced
content [CONFIRM once built]; access limited to staff who need it; regular security review.
No system is perfectly secure. If a breach is likely to harm you, we will tell you and the
relevant regulator as the law requires.

## 9. Your rights

Wherever you live, you can use the controls in [Settings → Privacy] or email [PRIVACY
EMAIL] to:

- see and get a copy of your information;
- correct it;
- delete it;
- export it in a portable format;
- withdraw a consent you gave;
- object to or restrict a use of it;
- opt out of marketing.

We respond within 30 days (one month in the EU and UK; 45 days under US state laws) and
never charge a fee or treat you worse for using your rights.

### South Africa (POPIA)

You may complain to the Information Regulator: [inforegulator.org.za](https://inforegulator.org.za),
complaints.IR@justice.gov.za. You may also request records under the Promotion of Access to
Information Act; our PAIA manual is at [LINK].

### European Union, EEA and United Kingdom (GDPR)

You have the rights listed above plus the right to complain to your local data protection
authority (in the UK, the Information Commissioner's Office).

### United States

We do not sell or share personal information as those words are defined in the California
Consumer Privacy Act, and we use sensitive personal information only to provide the
service you asked for. Residents of California, Colorado, Connecticut, Virginia, Texas,
Washington and other states with privacy laws have the rights to know, delete, correct and
appeal a refusal; to appeal, reply to our decision email. Consumer health data, as defined
in Washington's My Health My Data Act and similar laws, is collected and shared only with
your consent, as described in section 2. We do not create biometric identifiers or
templates of your face. [LAWYER: confirm position under Illinois BIPA and Texas CUBI once
the analysis kernel is final.]

### Australia (Privacy Act 1988)

We handle personal information in line with the Australian Privacy Principles. You may ask
for access or correction, and you may complain to us and then to the Office of the
Australian Information Commissioner: [oaic.gov.au](https://www.oaic.gov.au).

## 10. Children

Glowtrace is for people aged 18 and over. We do not knowingly collect information from
anyone under 18. If you believe a child has used Glowtrace, contact [PRIVACY EMAIL] and we
will delete the information.

## 11. Changes to this policy

We will post any change here and update the date above. For changes that matter, we will
tell you by email or in the app before they take effect, and ask for fresh consent where
the law requires it.

## 12. Contact

[COMPANY LEGAL NAME], [REGISTERED ADDRESS]. Privacy: [PRIVACY EMAIL]. Information Officer:
[NAME].
