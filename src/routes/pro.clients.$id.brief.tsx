import { createFileRoute, Link } from "@tanstack/react-router";

import { MakeupPrepPanel } from "@/components/makeup/makeup-prep-panel";
import { DEFAULT_PROFILE, recoverySteps, removalSteps } from "@/lib/makeup-day";
import { BUTTON_GHOST, PageHeader, PrimaryButton } from "@/components/ui/bits";
import { MessageCircle } from "lucide-react";
import { briefText, whatsappTo } from "@/lib/studio";
import { usePrefs } from "@/components/profile/use-profile";
import { useAppState } from "@/context/app-state";
import { findingsFor } from "@/lib/agent/agent";
import { longDate } from "@/lib/progress";

export const Route = createFileRoute("/pro/clients/$id/brief")({
  component: ClientBrief,
});

function ClientBrief() {
  const { id } = Route.useParams();
  const { clients, scans, looks, profile } = useAppState();
  const prefs = usePrefs();
  const client = clients.find((item) => item.id === id);
  if (!client) return <PageHeader title="Client not found" />;

  const clientScans = scans.filter((scan) => scan.client_id === client.id);
  const findings = findingsFor(clientScans);
  const latestSkin = clientScans
    .filter((scan) => scan.category === "skin" && !scan.demo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const look = looks.find((item) => item.client_id === client.id);
  const attention = findings.filter((finding) => finding.severity !== "good");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PageHeader
          title="Client brief"
          subtitle="Print this page or choose Save as PDF in the print dialog."
        />
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsappTo(
              client.contact_info,
              briefText({
                client: client.client_name,
                artist: prefs?.business.name || profile.display_name || "your artist",
                occasion: look?.occasion,
                focus: attention.slice(0, 3).map((finding) => finding.label.toLowerCase()),
                prep: [
                  ...(look?.skin_prep ?? []).slice(0, 4),
                  ...attention.slice(0, 2).map((finding) => finding.habit),
                ],
              }),
            )}
            target="_blank"
            rel="noreferrer"
            className={BUTTON_GHOST}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Send on WhatsApp
          </a>
          <PrimaryButton onClick={() => window.print()}>Print or save as PDF</PrimaryButton>
        </div>
      </div>

      <article className="surface space-y-5 p-6 print:border-0 print:p-0">
        <header>
          <p className="text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
            Client brief
          </p>
          <h1 className="font-display text-3xl font-semibold">{client.client_name}</h1>
          <p className="text-sm text-muted-foreground">
            Prepared by {profile.display_name}
            {look ? ` for ${look.occasion}` : ""}
          </p>
        </header>

        <section>
          <h2 className="font-display text-lg font-semibold">Skin</h2>
          <p className="text-sm text-muted-foreground">Skin type: {client.skin_type}</p>
          {client.notes && <p className="mt-1 text-sm text-muted-foreground">{client.notes}</p>}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Latest scan readings</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans on file yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {findings.map((finding) => (
                <li key={finding.concern} className="flex justify-between gap-3">
                  <span>{finding.label}</span>
                  <span className="text-muted-foreground">
                    {finding.severity === "focus"
                      ? "Needs attention"
                      : finding.severity === "watch"
                        ? "Keep an eye on it"
                        : "Looking good"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Base match and prep</h2>
          <div className="mt-1">
            <MakeupPrepPanel report={latestSkin?.report} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Aftercare: taking it off tonight</h2>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {removalSteps(latestSkin?.report ?? null, { ...DEFAULT_PROFILE, wear: "long" }).map(
              (step) => (
                <li key={step}>{step}</li>
              ),
            )}
          </ol>
          <h3 className="mt-3 font-semibold">The night after</h3>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {recoverySteps(latestSkin?.report ?? null, { ...DEFAULT_PROFILE, wear: "long" }).map(
              (step) => (
                <li key={step}>{step}</li>
              ),
            )}
          </ol>
        </section>

        {attention.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold">Habits to follow</h2>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {attention.slice(0, 3).map((finding) => (
                <li key={finding.concern}>{finding.habit}</li>
              ))}
            </ul>
          </section>
        )}

        {look && (
          <section>
            <h2 className="font-display text-lg font-semibold">Look plan</h2>
            <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              {look.skin_prep.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-2 text-sm text-muted-foreground">Hair: {look.hair_wig_style}</p>
            <p className="text-sm text-muted-foreground">Nails: {look.nail_design}</p>
          </section>
        )}

        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          Wellness indicators, not a medical assessment. Generated{" "}
          {longDate(new Date().toISOString())}. Powered by Glowtrace Pro.
        </footer>
      </article>

      <Link
        to="/pro/clients/$id"
        params={{ id: client.id }}
        className="inline-flex min-h-[50px] items-center font-semibold text-primary hover:underline print:hidden"
      >
        Back to {client.client_name}
      </Link>
    </div>
  );
}
