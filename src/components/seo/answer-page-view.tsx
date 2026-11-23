import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { FaqList } from "@/components/common/faq-list";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BUTTON_GHOST, BUTTON_PRIMARY, LogoMark } from "@/components/ui/bits";
import type { AnswerPage } from "@/content/answer-pages";

/** Shared layout for pages that answer one search: direct answer first, then detail. */
export const AnswerPageView = ({ page }: { page: AnswerPage }) => (
  <div className="min-h-dvh">
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link to="/" className="flex min-h-[50px] items-center gap-2">
          <LogoMark />
          <span className="font-display text-xl font-semibold">Glowtrace</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {/* On phones the same button sits right under the headline, so the bar stays one line. */}
          <Link to={page.cta.to} className={`${BUTTON_PRIMARY} max-sm:hidden`}>
            {page.cta.label}
          </Link>
        </div>
      </div>
    </header>

    <main className="mx-auto w-full max-w-4xl space-y-14 px-4 py-14 sm:px-6">
      <section className="page-enter">
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          {page.eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold sm:text-5xl">
          {page.h1}
        </h1>
        <p className="mt-6 text-lg text-foreground">{page.answer}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link to={page.cta.to} className={BUTTON_PRIMARY}>
            {page.cta.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link to="/" className={BUTTON_GHOST}>
            See how it works
          </Link>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="font-display text-3xl font-semibold">
          How it works
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {page.steps.map((step, index) => (
            // No scroll reveal here: this text must be visible to crawlers that don't scroll.
            <li key={step.title} className="surface p-5">
              <span className="readout text-xs text-muted-foreground">Step {index + 1}</span>
              <h3 className="mt-2 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why">
        <h2 id="why" className="font-display text-3xl font-semibold">
          Why people choose Glowtrace
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {page.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-foreground">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="space-y-4">
        <h2 id="faq" className="font-display text-3xl font-semibold">
          Questions people ask
        </h2>
        <FaqList faqs={page.faqs} />
      </section>
    </main>

    <footer className="border-t border-border">
      <p className="mx-auto max-w-4xl px-4 py-8 text-xs text-muted-foreground sm:px-6">
        Glowtrace gives wellness indicators from photos. It does not diagnose or treat any
        condition.{" "}
        <Link to="/pricing" className="font-semibold text-primary hover:underline">
          Pricing
        </Link>{" "}
        ·{" "}
        <Link to="/cookies" className="font-semibold text-primary hover:underline">
          Cookies
        </Link>
      </p>
    </footer>
  </div>
);
