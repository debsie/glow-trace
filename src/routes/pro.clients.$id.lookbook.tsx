import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ClipboardCopy, Download, History, Pencil, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, GhostButton, PrimaryButton, SectionCard, StatusBadge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { OCCASIONS, LIGHTING_PRESETS } from "@/lib/mock-data";

export const Route = createFileRoute("/pro/clients/$id/lookbook")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — Client Lookbook" },
      {
        name: "description",
        content: "Event lookbook: skin prep, makeup base, hair styling and nail art with client approval sign-off.",
      },
      { property: "og:title", content: "Glowtrace AI — Client Lookbook" },
      {
        property: "og:description",
        content: "Event lookbook: skin prep, makeup base, hair styling and nail art with client approval sign-off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LookbookPage,
});

function LookbookPage() {
  const { id } = Route.useParams();
  const { clients, scans, looks, updateLook, sendLookForClient, approveLookForClient, toggleLighting, saveLookToHistory } =
    useAppState();
  const client = clients.find((item) => item.id === id);
  const look = looks.find((item) => item.client_id === id);
  const [previewMode, setPreviewMode] = useState(false);
  const [note, setNote] = useState("");
  const seeded = useRef(false);

  // Auto-seed a draft look from the latest scan for clients without one yet.
  useEffect(() => {
    if (!client || look || seeded.current) return;
    seeded.current = true;
    const latest = scans
      .filter((scan) => scan.client_id === client.id && scan.category === "skin")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    updateLook(client.id, {
      skin_prep: latest
        ? [
            `Gentle cleanse matched to ${client.skin_type.toLowerCase()} skin`,
            "Targeted serum from latest biomarkers",
            "Barrier cream, 10-minute melt",
            "Hydrating primer, silicone-free",
          ]
        : ["Cleanse", "Treat", "Moisturize", "Prime"],
    });
  }, [client, look, scans, updateLook]);

  if (!client) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Client not found</h1>
        <SectionCard>
          <p className="text-muted-foreground">This client isn't in your roster.</p>
          <Link to="/pro/clients" className="mt-3 inline-flex min-h-[50px] items-center font-semibold text-primary hover:underline">
            Back to roster
          </Link>
        </SectionCard>
      </div>
    );
  }

  if (!look) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/pro/clients/$id" params={{ id: client.id }} aria-label="Back to client dashboard" className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h1 className="font-display text-2xl font-bold">{client.client_name} — Lookbook</h1>
        </div>
        <SectionCard>
          <p aria-live="polite" className="text-muted-foreground">Preparing the lookbook from the latest scan…</p>
        </SectionCard>
      </div>
    );
  }

  const locked = look.approved || previewMode;
  const occasionTag = `${look.occasion} / ${look.lighting[0] ?? "Studio"}`;

  const lookCards = [
    {
      title: "Skin Prep Routine",
      body: (
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          {look.skin_prep.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ),
    },
    {
      title: "Makeup & Foundation Base",
      body: (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Base:</span> {look.makeup_base}
          </p>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Undertone:</span> Neutral Cool ·{" "}
            <span className="font-semibold text-foreground">Finish:</span> Satin ·{" "}
            <span className="font-semibold text-foreground">Coverage:</span> Buildable medium
          </p>
        </div>
      ),
    },
    {
      title: "Hair & Wig Styling",
      body: <p className="text-sm text-muted-foreground">{look.hair_wig_style}</p>,
    },
    {
      title: "Nail Art & Finish",
      body: <p className="text-sm text-muted-foreground">{look.nail_design}</p>,
    },
  ];

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/pro/clients/$id"
            params={{ id: client.id }}
            aria-label="Back to client dashboard"
            className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{client.client_name}</h1>
            <StatusBadge status={look.status} />
          </div>
        </div>
        <GhostButton
          onClick={() => setPreviewMode((mode) => !mode)}
          aria-pressed={previewMode}
        >
          {previewMode ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {previewMode ? "Back to Edit Mode" : "Preview Client Share Link"}
        </GhostButton>
      </div>

      {previewMode && (
        <div className="glass glow-violet p-4" role="status">
          <p className="text-sm font-semibold text-accent">
            Read-only client view — this is exactly what {client.client_name.split(" ")[0]} sees on the share link.
          </p>
        </div>
      )}

      {/* Event card */}
      <SectionCard title={`Event · ${occasionTag}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="occasion" className="mb-1 block text-sm font-semibold text-muted-foreground">
              Occasion
            </label>
            <select
              id="occasion"
              value={look.occasion}
              disabled={locked}
              onChange={(event) => updateLook(client.id, { occasion: event.target.value })}
              className="min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground disabled:opacity-60"
            >
              {OCCASIONS.map((occasion) => (
                <option key={occasion} value={occasion}>
                  {occasion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-muted-foreground">Lighting</span>
            <div className="flex flex-wrap gap-2">
              {LIGHTING_PRESETS.map((preset) => {
                const active = look.lighting.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    disabled={locked}
                    onClick={() => toggleLighting(client.id, preset)}
                    className={`min-h-[50px] rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      active ? "ai-gradient border-transparent text-white" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Lookbook grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {lookCards.map((card) => (
          <SectionCard key={card.title} title={card.title} className="h-full">
            {card.body}
          </SectionCard>
        ))}
      </div>

      {/* Client approval view */}
      {previewMode && (
        <SectionCard title="Client sign-off" className="glow-violet">
          {look.approved ? (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success">
                <Check className="h-6 w-6" aria-hidden="true" />
              </span>
              <Badge tone="success">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approved by Client
              </Badge>
            </div>
          ) : (
            <>
              <label htmlFor="client-note" className="mb-1 block text-sm font-semibold text-muted-foreground">
                Add requests or adjustments for your MUA…
              </label>
              <textarea
                id="client-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-[80px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground"
                placeholder="e.g. softer lip, keep nails shorter…"
              />
              <PrimaryButton
                className="mt-3"
                onClick={() => {
                  sendLookForClient(client.id);
                  approveLookForClient(client.id, note);
                  toast.success("Look approved — your MUA has been notified.", {
                    description: "Prep schedule is locked in for the event.",
                  });
                }}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                Approve Look &amp; Prep Schedule
              </PrimaryButton>
            </>
          )}
        </SectionCard>
      )}

      {/* Bottom action bar */}
      <div className="glass sticky bottom-20 z-30 flex flex-wrap items-center justify-center gap-2 p-3 lg:bottom-6">
        <GhostButton onClick={() => toast.success("PDF brief exported to your files.")}>
          <Download className="h-4 w-4" aria-hidden="true" /> Export PDF Brief
        </GhostButton>
        <GhostButton
          onClick={() => {
            navigator.clipboard
              .writeText(`${window.location.origin}/pro/clients/${client.id}/lookbook`)
              .then(() => toast.success("Approval link copied to clipboard."))
              .catch(() => toast.error("Couldn't copy — copy the URL from the address bar."));
          }}
        >
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy Approval Link
        </GhostButton>
        <GhostButton
          onClick={() => {
            saveLookToHistory(client.id);
            toast.success("Look saved to client history.");
          }}
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {look.saved_to_history ? "Saved to History" : "Save Look to Client History"}
        </GhostButton>
      </div>
    </div>
  );
}
