import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { LineArt } from "@/components/art/line-art";
import { useGuideContext } from "@/components/guides/use-guide-context";
import { Reveal } from "@/components/motion/reveal";
import { ThreeCanvas } from "@/components/three/three-canvas";
import { Badge } from "@/components/ui/bits";
import { route } from "@/lib/agent/retrieve";
import { GUIDE_AREAS, GUIDES } from "@/lib/guides";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/")({
  validateSearch: z.object({
    area: z.enum(["all", "skin", "hair", "nails", "everyday"]).optional(),
  }),
  head: () =>
    pageHead({
      title: "Glow Guides — Glowtrace",
      description:
        "Plain, practical guides to skin, hair and nails: dark marks, sunscreen on deeper skin, braids and edges, shrinkage, nail stains and more.",
      path: "/guides",
      noindex: true,
    }),
  component: GuidesPage,
});

const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";

function GuidesPage() {
  const { area = "all" } = Route.useSearch();
  const navigate = useNavigate();
  const context = useGuideContext();
  const [query, setQuery] = useState("");
  const [miss, setMiss] = useState(false);
  const shown = GUIDES.filter((guide) => area === "all" || guide.area === area);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <ThreeCanvas
          scene="field"
          base="muted-foreground"
          accent="primary"
          className="absolute right-0 bottom-0 h-[60%] w-full opacity-60 sm:w-[55%]"
        />
        <div className="page-enter relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className={LABEL}>Glow Guides</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold sm:text-6xl">
              Know what helps,
              <br />
              <span className="text-primary">and why.</span>
            </h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Short, honest guides for skin, hair and nails, written for every skin tone and hair
              type. Where you've scanned, your own reading comes first.
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const result = route(query);
              if (result.kind === "topic") {
                void navigate({ to: "/guides/$id", params: { id: result.topic.id } });
              } else {
                setMiss(true);
              }
            }}
          >
            <label className="sr-only" htmlFor="guide-search">
              Search the guides
            </label>
            <input
              id="guide-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMiss(false);
              }}
              placeholder="e.g. edges thinning, dark marks"
              className="min-h-[50px] min-w-0 flex-1 rounded-lg border border-input bg-background px-4 text-base"
            />
            <button
              type="submit"
              aria-label="Search"
              className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
        {miss && (
          <p className="relative px-6 pb-6 text-sm text-muted-foreground sm:px-10" role="status">
            No guide for that yet. Try a few words, or ask your agent.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Area">
        {[{ id: "all" as const, label: "All guides" }, ...GUIDE_AREAS].map((item) => (
          <Link
            key={item.id}
            to="/guides"
            search={{ area: item.id }}
            role="tab"
            aria-selected={area === item.id}
            className={`inline-flex min-h-[50px] items-center rounded-2xl border px-5 text-sm font-semibold transition-colors ${
              area === item.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {(area === "all" ? GUIDE_AREAS : GUIDE_AREAS.filter((item) => item.id === area)).map(
        (section) => {
          const guides = shown.filter((guide) => guide.area === section.id);
          return (
            <section key={section.id} aria-labelledby={`area-${section.id}`} className="space-y-4">
              <Reveal className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id={`area-${section.id}`} className="font-display text-3xl font-semibold">
                    {section.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">{section.lead}</p>
                </div>
                <span className="readout text-sm text-muted-foreground">
                  {String(guides.length).padStart(2, "0")} guides
                </span>
              </Reveal>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {guides.map((guide, index) => {
                  const personal = guide.personal?.(context) ?? null;
                  return (
                    <Reveal key={guide.id} delay={(index % 6) * 70}>
                      <Link
                        to="/guides/$id"
                        params={{ id: guide.id }}
                        className="surface lift flex h-full min-h-[180px] flex-col justify-between gap-4 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-xl leading-snug font-semibold">
                            {guide.title}
                          </h3>
                          <LineArt motif={guide.motif} className="h-14 w-14 shrink-0" />
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {guide.body[0]}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          {personal ? <Badge tone="accent">Your reading inside</Badge> : <span />}
                          <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
                        </div>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            </section>
          );
        },
      )}
    </div>
  );
}
