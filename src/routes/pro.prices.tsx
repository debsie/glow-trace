import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import { StudioGate } from "@/components/studio/studio-gate";
import { BUTTON_GHOST, BUTTON_PRIMARY, GhostButton } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { pageHead } from "@/lib/seo";
import type { Service } from "@/lib/studio";
import {
  DEFAULT_SERVICES,
  duration,
  loadServices,
  priceListText,
  rand,
  saveServices,
  serviceSchema,
  whatsappTo,
} from "@/lib/studio";

export const Route = createFileRoute("/pro/prices")({
  head: () =>
    pageHead({
      title: "Price list — Glowtrace MUA Studio",
      description: "Your services, prices and times, ready to send on WhatsApp or print.",
      path: "/pro/prices",
      noindex: true,
    }),
  component: () => (
    <StudioGate title="Price list">
      <PricesPage />
    </StudioGate>
  ),
});

const input = "min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base";

function PricesPage() {
  const { profile } = useAppState();
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState({ name: "", price: "", minutes: "60" });
  const [note, setNote] = useState("");
  useEffect(() => setServices(loadServices()), []);

  const update = (next: Service[]) => {
    setServices(next);
    saveServices(next);
  };
  const artist = profile.display_name || "Your artist";

  return (
    <div className="space-y-8">
      <section className="surface-strong page-enter relative overflow-hidden p-6 sm:p-10 print:border-0 print:p-0">
        <LineArt
          motif="lips"
          className="art-draw art-breathe pointer-events-none absolute top-6 right-6 hidden h-24 w-24 opacity-80 sm:block print:hidden"
        />
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Price list
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{artist}</h1>
        <ul className="mt-8 max-w-xl divide-y divide-border">
          {services.map((service, index) => (
            <Reveal
              as="li"
              key={service.id}
              delay={index * 50}
              className="flex items-baseline gap-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{service.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {duration(service.minutes)}
                </span>
              </span>
              <span className="readout text-lg">{rand(service.price)}</span>
              <button
                type="button"
                aria-label={`Remove ${service.name}`}
                onClick={() => update(services.filter((s) => s.id !== service.id))}
                className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary print:hidden"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </Reveal>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <a
            href={whatsappTo("", priceListText(services, artist))}
            target="_blank"
            rel="noreferrer"
            className={BUTTON_PRIMARY}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Send on WhatsApp
          </a>
          <GhostButton onClick={() => window.print()}>
            <Printer className="h-5 w-5" aria-hidden="true" /> Print or save as PDF
          </GhostButton>
        </div>
      </section>

      <section className="surface p-5 print:hidden" aria-labelledby="add-service">
        <h2
          id="add-service"
          className="label-tracking text-xs font-bold text-muted-foreground uppercase"
        >
          Add a service
        </h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_140px_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = serviceSchema.safeParse({
              id: `svc_${Date.now().toString(36)}`,
              name: draft.name,
              price: Math.round(Number(draft.price)),
              minutes: Math.round(Number(draft.minutes)),
            });
            if (!parsed.success) {
              setNote("Add a name, a price in rand and a time in minutes");
              return;
            }
            update([...services, parsed.data]);
            setDraft({ name: "", price: "", minutes: "60" });
            setNote(`Added ${parsed.data.name}`);
          }}
        >
          <label className="text-sm font-semibold">
            Service
            <input
              className={`${input} mt-1 font-normal`}
              value={draft.name}
              maxLength={80}
              required
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="text-sm font-semibold">
            Price (R)
            <input
              className={`${input} mt-1 font-normal`}
              inputMode="numeric"
              value={draft.price}
              required
              onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })}
            />
          </label>
          <label className="text-sm font-semibold">
            Minutes
            <input
              className={`${input} mt-1 font-normal`}
              inputMode="numeric"
              value={draft.minutes}
              required
              onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/\D/g, "") })}
            />
          </label>
          <button type="submit" className={BUTTON_GHOST}>
            <Plus className="h-5 w-5" aria-hidden="true" /> Add
          </button>
        </form>
        <p className="mt-3 min-h-5 text-sm" role="status">
          {note}
        </p>
        <button
          type="button"
          onClick={() => update(DEFAULT_SERVICES)}
          className="text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Reset to the starting list
        </button>
        <p className="mt-3 text-xs text-muted-foreground">Kept on this device.</p>
      </section>
    </div>
  );
}
