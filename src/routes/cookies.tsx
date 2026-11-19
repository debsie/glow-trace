import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Badge, PageHeader, SectionCard } from "@/components/ui/bits";
import { breadcrumbSchema, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/cookies")({
  head: () =>
    pageHead({
      title: "Cookies and Storage — Glowtrace",
      description:
        "Glowtrace sets no cookies and no trackers. Here is everything it keeps in your browser, why, and for how long.",
      path: "/cookies",
      schema: [
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Cookies and storage", path: "/cookies" },
        ]),
      ],
    }),
  component: CookiesPage,
});

type Item = { name: string; where: string; why: string; kept: string };

const ITEMS: Item[] = [
  {
    name: "Sign-in session",
    where: "Browser local storage (sb-…-auth-token)",
    why: "Keeps you signed in to the beta. Set only when you sign in.",
    kept: "Until you sign out or delete your account",
  },
  {
    name: "Bot check on sign-in",
    where: "Loaded from Cloudflare (challenges.cloudflare.com), on the sign-in page only",
    why: "Cloudflare Turnstile checks that a person, not a script, is asking for a sign-in email. Cloudflare may keep its own browser storage for this check. We don't see or store it.",
    kept: "Set by Cloudflare, only while you use the sign-in page",
  },
  {
    name: "Your scans and photos",
    where: 'Browser database (IndexedDB, "glowtrace")',
    why: "Your scan history, photos, shelf, clients and lookbooks. They never leave this device.",
    kept: "Until you delete them on the Your Data page",
  },
  {
    name: "Plan and monthly usage",
    where: "Browser local storage (glowtrace:account:v1)",
    why: "Which plan you're on and how many scans you've used this month, so limits work.",
    kept: "Until you delete your data",
  },
  {
    name: "Scan guide files (only once you use a guided scan)",
    where: "Browser cache storage (glowtrace-face-guide-1)",
    why: "The on-device guides' program and models (face, hand, hair), about 15 MB plus 1-8 MB per area, so they download once. Nothing about you.",
    kept: "Until you clear this site's data",
  },
  {
    name: "Offline copy of the app",
    where: "Browser cache storage (glowtrace-v1)",
    why: "Lets the app open and scan without a connection. Holds app pages and files, nothing about you.",
    kept: "Replaced on each app update",
  },
];

function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link
        to="/"
        className="inline-flex min-h-[50px] items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Glowtrace
      </Link>
      <PageHeader
        title="Cookies and Storage"
        subtitle="Glowtrace sets no cookies, runs no analytics and loads no ads. The only outside script is a bot check on the sign-in page. A barcode scan asks Open Beauty Facts for the product's ingredients, sending only the number."
      />

      <SectionCard>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">No cookies</Badge>
          <Badge tone="success">No analytics</Badge>
          <Badge tone="success">No ad trackers</Badge>
          <Badge tone="success">No third-party fonts</Badge>
          <Badge tone="success">One third-party script: the sign-in bot check</Badge>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Everything below is strictly necessary for the feature you're using, so the law doesn't
          require a consent banner for it: the EU and UK ePrivacy rules, POPIA in South Africa and
          similar laws elsewhere exempt storage that a service needs to work. If Glowtrace ever adds
          anything optional, such as analytics, we'll ask first and you can say no.
        </p>
      </SectionCard>

      <section aria-labelledby="what" className="space-y-3">
        <h2 id="what" className="font-display text-2xl font-semibold">
          What's stored in your browser
        </h2>
        <ul className="space-y-3">
          {ITEMS.map((item) => (
            <li key={item.name} className="surface p-5">
              <h3 className="font-display text-lg font-semibold">{item.name}</h3>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">Where</dt>
                <dd className="text-foreground">{item.where}</dd>
                <dt className="text-muted-foreground">Why</dt>
                <dd className="text-foreground">{item.why}</dd>
                <dt className="text-muted-foreground">Kept</dt>
                <dd className="text-foreground">{item.kept}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <SectionCard title="Control it">
        <p className="text-sm text-muted-foreground">
          You can download or delete everything Glowtrace keeps on this device, and your account,
          from{" "}
          <Link to="/privacy" className="font-semibold text-primary hover:underline">
            Your Data
          </Link>
          . You can also clear this site's data in your browser settings at any time.
        </p>
      </SectionCard>
    </div>
  );
}
