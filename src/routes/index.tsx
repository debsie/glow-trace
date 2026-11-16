import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { Badge, BUTTON_GHOST, BUTTON_PRIMARY, Gauge, LogoMark } from "@/components/ui/bits";
import { formatZar, PLANS } from "@/lib/plans";
import { pageHead, SITE, softwareApplicationSchema } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Glowtrace — Read Your Skin Like a Lab Report | Skin, Hair & Nail Diagnostics",
      description: SITE.description,
      path: "/",
      schema: [softwareApplicationSchema()],
    }),
  component: LandingPage,
});

const SAMPLE_READING = [
  {
    label: "Erythema / Redness",
    value: 32.9,
    caption: "Higher means more. How red the skin tone reads.",
  },
  {
    label: "Texture Coarseness",
    value: 37.6,
    caption: "Higher means more. How uneven the surface looks.",
  },
  {
    label: "Hydration",
    value: 69.9,
    caption: "Higher is better. Smooth, lightly glowing surfaces score higher.",
  },
  { label: "Discoloration", value: 5.9, caption: "Higher means more. How patchy the colour is." },
];

const INDICATORS = [
  {
    area: "Skin",
    name: "Erythema",
    reads: "Redness, from the a* axis of CIELab",
    range: "a* 9 pale to 27 inflamed",
  },
  {
    area: "Skin",
    name: "Texture coarseness",
    reads: "Surface unevenness, from local luminance change",
    range: "0 flat to 14 rough",
  },
  {
    area: "Skin",
    name: "Hydration",
    reads: "Highlights against flaky, matte patches",
    range: "0 dry to 100 supple",
  },
  {
    area: "Hair",
    name: "Shine",
    reads: "Share of specular pixels across the strands",
    range: "0 matte to 20% highlight",
  },
  {
    area: "Nails",
    name: "Yellowness",
    reads: "Staining, from the b* axis of CIELab",
    range: "b* 10 healthy to 26 yellowed",
  },
];

const STEPS = [
  { title: "Scan", body: "Take or upload a close, well-lit photo of skin, hair or nails." },
  {
    title: "Read",
    body: "Each indicator is scored from 0 to 100 on your device, with a plain-language note on what it means.",
  },
  {
    title: "Act",
    body: "Today's routine matches your results to the products on your shelf, with a DIY alternative when something is missing.",
  },
  {
    title: "Compare",
    body: "Every scan is saved, so you can see what changed after two weeks of the routine.",
  },
];

const ARTIST_POINTS = [
  "Scan history per client, so skin prep is based on the last reading",
  "Event looks with lighting presets: daylight, studio flash and candlelight",
  "Read-only client lookbook with one-tap sign-off",
  "Saved looks become a history you can reuse for repeat events",
];

const SECTION = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";
const NAV_LINK =
  "inline-flex min-h-[50px] items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground";

function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className={`${SECTION} flex items-center justify-between gap-3 py-4`}>
        <Link to="/" className="flex min-h-[50px] items-center gap-2">
          <LogoMark />
          <span className="font-display text-xl font-semibold text-foreground">Glowtrace</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <a href="#measures" className={`${NAV_LINK} hidden md:inline-flex`}>
            What it measures
          </a>
          <a href="#artists" className={`${NAV_LINK} hidden md:inline-flex`}>
            For artists
          </a>
          <Link to="/pricing" className={`${NAV_LINK} hidden sm:inline-flex`}>
            Pricing
          </Link>
          <Link to="/app" className={`${BUTTON_PRIMARY} ml-2`}>
            Open the app
          </Link>
        </nav>
      </header>

      <main>
        <section className={`${SECTION} grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_1fr]`}>
          <div>
            <p className={LABEL}>Skin, hair and nail diagnostics</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] font-semibold text-foreground sm:text-6xl">
              Read your skin
              <br />
              like a lab report.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Upload a photo and Glowtrace scores redness, texture, hydration and more on your
              device. Then it builds today's routine from the products you already own.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link to="/scan" className={BUTTON_PRIMARY}>
                Start a scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link to="/pro/clients" className={BUTTON_GHOST}>
                I'm a makeup artist
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Photos are analysed in your browser and are not uploaded.
            </p>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className={`${LABEL} font-sans`}>Sample reading · Skin</h2>
              <Badge tone="accent">On-device</Badge>
            </div>
            <div className="mt-5 space-y-5">
              {SAMPLE_READING.map((gauge) => (
                <Gauge key={gauge.label} {...gauge} />
              ))}
            </div>
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              Example values to show the layout. Wellness indicators, not a medical measurement.
            </p>
          </div>
        </section>

        <section id="measures" className="scroll-mt-6 border-t border-border bg-card py-14">
          <div className={SECTION}>
            <p className={LABEL}>What it measures</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight font-semibold">
              Every score comes from pixels, with the formula in the open.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              No black box. Each indicator is a fixed formula over colour and texture in your photo,
              so the same photo always gives the same result.
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Area
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Indicator
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      What it reads
                    </th>
                    <th scope="col" className="py-3 font-semibold">
                      Calibrated range
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {INDICATORS.map((row) => (
                    <tr key={row.name} className="border-b border-border">
                      <td className="py-3 pr-4 text-muted-foreground">{row.area}</td>
                      <th scope="row" className="py-3 pr-4 font-semibold text-foreground">
                        {row.name}
                      </th>
                      <td className="py-3 pr-4 text-foreground">{row.reads}</td>
                      <td className="readout py-3 text-xs text-foreground">{row.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-14">
          <div className={SECTION}>
            <p className={LABEL}>How it works</p>
            <h2 className="mt-3 font-display text-3xl leading-tight font-semibold">
              From a photo to a routine you can follow.
            </h2>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="surface p-5">
                  <p className="readout text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="mt-3 font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="artists" className="scroll-mt-6 border-t border-border bg-card py-14">
          <div className={`${SECTION} grid gap-10 lg:grid-cols-2`}>
            <div>
              <p className={LABEL}>MUA Pro Portal</p>
              <h2 className="mt-3 max-w-md font-display text-3xl leading-tight font-semibold">
                A studio view for makeup artists and their clients.
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Keep each client's scans, skin notes and event looks in one place. Send a lookbook,
                and the client reviews and signs off from a private link.
              </p>
              <Link to="/pro/clients" className={`${BUTTON_GHOST} mt-6`}>
                Open the client roster <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
            <ul className="space-y-4">
              {ARTIST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-foreground">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border py-14">
          <div className={SECTION}>
            <div className="surface flex flex-wrap items-center justify-between gap-4 p-7">
              <div>
                <h2 className="font-display text-3xl font-semibold">Run your first scan.</h2>
                <p className="mt-2 text-muted-foreground">
                  It takes under a second, and nothing leaves your device. Free to start;{" "}
                  {PLANS.pro.name} is {formatZar(PLANS.pro.monthlyZar)} a month.
                </p>
              </div>
              <Link to="/scan" className={BUTTON_PRIMARY}>
                Start a scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={`${SECTION} space-y-4 pb-10`}>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-2">
          <Link to="/pricing" className={NAV_LINK}>
            Pricing
          </Link>
          <Link to="/refer" className={NAV_LINK}>
            Invite friends
          </Link>
          <Link to="/affiliates" className={NAV_LINK}>
            Partner programme
          </Link>
        </nav>
        <p className="px-3 text-sm text-muted-foreground">
          Glowtrace gives wellness indicators from photos. It does not diagnose or treat any
          condition. See a clinician for skin, hair or nail concerns.
        </p>
      </footer>
    </div>
  );
}
