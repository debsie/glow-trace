import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MessagesSquare } from "lucide-react";

import { LineArt } from "@/components/art/line-art";
import { useGuideContext } from "@/components/guides/use-guide-context";
import { Reveal } from "@/components/motion/reveal";
import { BUTTON_PRIMARY } from "@/components/ui/bits";
import { GUIDE_AREAS, guideById, relatedGuides } from "@/lib/guides";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/$id")({
  loader: ({ params }) => {
    const guide = guideById(params.id);
    if (!guide) throw notFound();
    return { id: guide.id };
  },
  head: ({ params }) => {
    const guide = guideById(params.id);
    return pageHead({
      title: `${guide?.title ?? "Guide"} — Glow Guides`,
      description: guide?.body[0] ?? "A Glowtrace guide.",
      path: `/guides/${params.id}`,
      noindex: true,
    });
  },
  component: GuidePage,
});

const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";

function GuidePage() {
  const { id } = Route.useLoaderData();
  const guide = guideById(id);
  const context = useGuideContext();
  if (!guide) return null;
  const personal = guide.personal?.(context) ?? null;
  const area = GUIDE_AREAS.find((item) => item.id === guide.area);

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <Link
        to="/guides"
        search={{ area: guide.area }}
        className="inline-flex min-h-[50px] items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {area?.label ?? "Guides"} guides
      </Link>

      <header className="page-enter grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className={LABEL}>Glow Guide · {area?.label}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">
            {guide.title}
          </h1>
        </div>
        <LineArt motif={guide.motif} className="h-32 w-32 sm:h-40 sm:w-40" />
      </header>

      {personal && (
        <Reveal className="rounded-xl border border-primary bg-card p-5">
          <p className={LABEL}>Your reading</p>
          <p className="mt-2 font-display text-xl leading-snug font-semibold">{personal}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            From your latest scans on this phone. A wellness indicator, not a diagnosis.
          </p>
        </Reveal>
      )}

      <ol className="space-y-6">
        {guide.body.map((paragraph, index) => (
          <Reveal
            as="li"
            key={paragraph}
            delay={index * 90}
            className="grid gap-4 sm:grid-cols-[3rem_1fr]"
          >
            <span className="readout flex h-11 w-11 items-center justify-center rounded-full border border-primary text-sm text-primary">
              0{index + 1}
            </span>
            <p className="text-lg leading-relaxed">{paragraph}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Link to="/agent" className={BUTTON_PRIMARY}>
          <MessagesSquare className="h-5 w-5" aria-hidden="true" /> Ask about this
        </Link>
      </Reveal>

      <section aria-labelledby="related" className="space-y-3">
        <h2 id="related" className={LABEL}>
          Keep reading
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {relatedGuides(guide).map((other, index) => (
            <Reveal key={other.id} delay={index * 80}>
              <Link
                to="/guides/$id"
                params={{ id: other.id }}
                className="surface lift flex h-full min-h-[120px] flex-col justify-between gap-3 p-4"
              >
                <LineArt motif={other.motif} className="h-10 w-10" />
                <span className="flex items-center justify-between gap-2 font-semibold">
                  {other.title}
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </article>
  );
}
