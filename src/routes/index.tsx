import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Eye, Lock, Pencil, Repeat, Send, SunMedium } from "lucide-react";

import { HeroInstrument } from "@/components/landing/hero-instrument";
import { Reveal } from "@/components/motion/reveal";
import { ThreeCanvas } from "@/components/three/three-canvas";
import { Badge, BUTTON_GHOST, BUTTON_PRIMARY, LogoMark } from "@/components/ui/bits";
import { formatZar, PLAN_ORDER, PLANS } from "@/lib/plans";
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

const PROOF = [
  { value: "0–100", label: "every indicator scored" },
  { value: "<1s", label: "per scan" },
  { value: "0", label: "photos uploaded" },
];

const TICKER = [
  "Erythema",
  "Texture coarseness",
  "Hydration",
  "Discoloration",
  "Shine",
  "Porosity",
  "Density variance",
  "Yellowness",
  "Ridge texture",
  "Spots",
];

const INDICATORS = [
  {
    area: "Skin",
    name: "Erythema",
    reads: "Redness, from the a* axis of CIELab",
    range: "a* 9 → 27",
    ends: ["pale", "inflamed"],
    fill: 33,
  },
  {
    area: "Skin",
    name: "Texture coarseness",
    reads: "Surface unevenness, from local luminance change",
    range: "0 → 14",
    ends: ["flat", "rough"],
    fill: 38,
  },
  {
    area: "Skin",
    name: "Hydration",
    reads: "Highlights against flaky, matte patches",
    range: "0 → 100",
    ends: ["dry", "supple"],
    fill: 70,
  },
  {
    area: "Hair",
    name: "Shine",
    reads: "Share of specular pixels across the strands",
    range: "0 → 20%",
    ends: ["matte", "highlight"],
    fill: 58,
  },
  {
    area: "Nails",
    name: "Yellowness",
    reads: "Staining, from the b* axis of CIELab",
    range: "b* 10 → 26",
    ends: ["healthy", "yellowed"],
    fill: 13,
  },
];

const STEPS = [
  { title: "Scan", body: "A close, well-lit photo of skin, hair or nails." },
  { title: "Read", body: "Each indicator scored 0 to 100, with a plain note." },
  { title: "Act", body: "A routine from your own shelf. DIY when something is missing." },
  { title: "Compare", body: "Every scan is saved. See what two weeks changed." },
];

const ARTIST_POINTS = [
  { icon: Repeat, text: "Scan history per client" },
  { icon: SunMedium, text: "Daylight, flash and candlelight presets" },
  { icon: Eye, text: "Read-only lookbook, one-tap sign-off" },
  { icon: Lock, text: "A private link for each client" },
];

const LOOK_STAGES = [
  { icon: Pencil, label: "Drafting" },
  { icon: Send, label: "Sent" },
  { icon: Check, label: "Approved" },
];

const SECTION = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";
const NAV_LINK =
  "inline-flex min-h-[50px] items-center px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground";
const H2 = "mt-3 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl";

function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className={`${SECTION} flex items-center justify-between gap-3 py-2`}>
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
            <Link to="/login" className={`${NAV_LINK} hidden sm:inline-flex`}>
              Sign in
            </Link>
            <Link to="/app" className={`${BUTTON_PRIMARY} ml-2`}>
              Open the app
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero, over a live topography field */}
        <div className="relative">
          <ThreeCanvas
            scene="field"
            base="muted-foreground"
            accent="primary"
            className="absolute inset-x-0 bottom-0 h-[70%]"
          />
          <section
            className={`${SECTION} relative grid items-center gap-10 pt-14 pb-24 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32`}
          >
            <div className="page-enter">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span
                  className="pulse-dot h-1.5 w-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />
                Skin, hair and nail diagnostics
              </p>
              <h1 className="mt-5 font-display text-5xl leading-[1.02] font-semibold text-foreground sm:text-7xl">
                Read your skin
                <br />
                like a <span className="text-primary">lab report.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                One photo. Scored on your device. A routine built from what you already own.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link to="/scan" className={BUTTON_PRIMARY}>
                  Start a scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link to="/pro/clients" className={BUTTON_GHOST}>
                  I'm a makeup artist
                </Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                {PROOF.map((item) => (
                  <div key={item.label}>
                    <dt className="sr-only">{item.label}</dt>
                    <dd>
                      <span className="readout block text-2xl text-foreground">{item.value}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <Reveal delay={150}>
              <HeroInstrument />
            </Reveal>
          </section>
        </div>

        {/* Indicator ticker */}
        <div className="overflow-hidden border-y border-border bg-card py-4" aria-hidden="true">
          <div className="marquee flex w-max gap-10 pr-10">
            {[...TICKER, ...TICKER].map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="readout flex items-center gap-10 text-sm whitespace-nowrap text-muted-foreground"
              >
                {name}
                <span className="h-1 w-1 rounded-full bg-primary" />
              </span>
            ))}
          </div>
        </div>

        {/* What it measures: bento */}
        <section id="measures" className={`${SECTION} scroll-mt-20 py-20`}>
          <Reveal>
            <p className={LABEL}>What it measures</p>
            <h2 className={`${H2} max-w-2xl`}>Every score comes from pixels.</h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              No black box. Fixed formulas, in the open. Same photo, same result.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {INDICATORS.map((item, index) => (
              <Reveal
                key={item.name}
                delay={index * 70}
                className={`surface lift p-5 ${index < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="accent">{item.area}</Badge>
                  <span className="readout text-xs text-muted-foreground">{item.range}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.reads}</p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${item.fill}%` }}
                  />
                </div>
                <div className="readout mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{item.ends[0]}</span>
                  <span>{item.ends[1]}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card py-20">
          <div className={SECTION}>
            <Reveal>
              <p className={LABEL}>How it works</p>
              <h2 className={`${H2} max-w-2xl`}>Photo to routine in four steps.</h2>
            </Reveal>
            <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 110} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="readout flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary text-sm text-primary">
                      0{index + 1}
                    </span>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Artists */}
        <section id="artists" className={`${SECTION} scroll-mt-20 py-20`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className={LABEL}>MUA Pro Portal</p>
              <h2 className={H2}>A studio view for artists and their clients.</h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Scans, skin notes and event looks in one place. Your client signs off from a link.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {ARTIST_POINTS.map((point) => (
                  <li
                    key={point.text}
                    className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground"
                  >
                    <point.icon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    {point.text}
                  </li>
                ))}
              </ul>
              <Link to="/pro/clients" className={`${BUTTON_GHOST} mt-8`}>
                Open the client roster <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Reveal>

            <Reveal delay={150} className="surface p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={LABEL}>Lookbook · Wedding</p>
                  <p className="mt-2 font-display text-2xl font-semibold">Imani Okafor</p>
                </div>
                <Badge tone="success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approved
                </Badge>
              </div>
              <ol className="mt-6 flex items-center">
                {LOOK_STAGES.map((stage, index) => (
                  <li key={stage.label} className="flex flex-1 items-center last:flex-none">
                    <span className="flex flex-col items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <stage.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {stage.label}
                      </span>
                    </span>
                    {index < LOOK_STAGES.length - 1 && (
                      <span className="mx-2 mb-6 h-px flex-1 bg-primary" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
              <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
                {[
                  ["Skin prep", "Barrier cream, 10-minute melt"],
                  ["Base", "Neutral cool, satin finish"],
                  ["Lighting", "Daylight 5000K"],
                ].map(([term, detail]) => (
                  <div key={term} className="flex min-h-[48px] items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="text-right font-semibold text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Example lookbook.</p>
            </Reveal>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="border-y border-border bg-card py-20">
          <div className={SECTION}>
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={LABEL}>Pricing</p>
                <h2 className={H2}>Priced in rands. Start free.</h2>
              </div>
              <Link to="/pricing" className={BUTTON_GHOST}>
                Compare plans <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Reveal>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {PLAN_ORDER.map((id, index) => {
                const plan = PLANS[id];
                return (
                  <Reveal key={id} delay={index * 90}>
                    <Link
                      to="/pricing"
                      className={`lift block h-full p-6 ${id === "pro" ? "surface-strong" : "surface bg-background"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-display text-xl font-semibold">{plan.name}</span>
                        {id === "pro" && <Badge tone="primary">Most popular</Badge>}
                      </span>
                      <span className="mt-4 block">
                        <span className="font-display text-5xl font-semibold text-foreground">
                          {formatZar(plan.monthlyZar)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {plan.monthlyZar === 0 ? " forever" : " / month"}
                        </span>
                      </span>
                      <span className="mt-3 block text-sm text-muted-foreground">
                        {plan.tagline}
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className={`${SECTION} py-20`}>
          <Reveal className="grid items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground lg:grid-cols-[1.1fr_1fr]">
            <div className="px-6 py-14 sm:px-12">
              <h2 className="font-display text-4xl leading-tight font-semibold sm:text-6xl">
                Run your first scan.
              </h2>
              <p className="mt-4 max-w-md opacity-90">
                Under a second. Nothing leaves your device.
              </p>
              <Link
                to="/scan"
                className="mt-8 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-primary-foreground px-7 text-base font-semibold text-primary transition-opacity hover:opacity-90"
              >
                Start a scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
            <ThreeCanvas
              scene="ring"
              base="primary-foreground"
              accent="primary-foreground"
              className="h-64 lg:h-full lg:min-h-[340px]"
            />
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-4 py-6`}>
          <span className="flex items-center gap-2">
            <LogoMark className="h-5 w-5" />
            <span className="font-display font-semibold">Glowtrace</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap">
            <Link to="/pricing" className={NAV_LINK}>
              Pricing
            </Link>
            <Link to="/refer" className={NAV_LINK}>
              Invite friends
            </Link>
            <Link to="/affiliates" className={NAV_LINK}>
              Partner programme
            </Link>
            <Link to="/privacy" className={NAV_LINK}>
              Your data
            </Link>
          </nav>
        </div>
        <p className={`${SECTION} pb-10 text-xs text-muted-foreground`}>
          Glowtrace gives wellness indicators from photos. It does not diagnose or treat any
          condition. See a clinician for skin, hair or nail concerns.
        </p>
      </footer>
    </div>
  );
}
