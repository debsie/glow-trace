import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge, GhostButton, PageHeader, PrimaryButton, SectionCard, StatusBadge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import type { NewClientInput } from "@/lib/types";

export const Route = createFileRoute("/pro/clients")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — MUA Client Roster" },
      {
        name: "description",
        content: "Your professional client roster: scans, skin prep, hair pairings and look approvals.",
      },
      { property: "og:title", content: "Glowtrace AI — MUA Client Roster" },
      {
        property: "og:description",
        content: "Your professional client roster: scans, skin prep, hair pairings and look approvals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

const QuickAddModal = ({ onClose }: { onClose: () => void }) => {
  const { addClient } = useAppState();
  const [form, setForm] = useState<NewClientInput>({ client_name: "", contact_info: "", skin_type: "", notes: "" });

  const submit = () => {
    if (!form.client_name.trim()) {
      toast.error("Give your client a name first.");
      return;
    }
    addClient(form);
    toast.success(`${form.client_name.trim()} added to your roster.`);
    onClose();
  };

  const field =
    "min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Quick add client"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md space-y-3 rounded-b-none p-5 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold">Quick add client</h2>
        <input
          className={field}
          placeholder="Client name"
          aria-label="Client name"
          autoFocus
          value={form.client_name}
          onChange={(event) => setForm({ ...form, client_name: event.target.value })}
        />
        <input
          className={field}
          placeholder="Contact (email · phone)"
          aria-label="Contact info"
          value={form.contact_info}
          onChange={(event) => setForm({ ...form, contact_info: event.target.value })}
        />
        <input
          className={field}
          placeholder="Skin type (e.g. Combination · Sensitive)"
          aria-label="Skin type"
          value={form.skin_type}
          onChange={(event) => setForm({ ...form, skin_type: event.target.value })}
        />
        <textarea
          className={`${field} min-h-[80px] py-3`}
          placeholder="Notes — preferences, event dates, sensitivities…"
          aria-label="Client notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
        <div className="flex gap-2 pt-1">
          <PrimaryButton onClick={submit} className="flex-1">
            Add client
          </PrimaryButton>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
        </div>
      </div>
    </div>
  );
};

function ClientsPage() {
  const { clients, scans, looks } = useAppState();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (client) =>
        client.client_name.toLowerCase().includes(q) || client.skin_type.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Roster"
        subtitle={`${clients.length} clients · scans, prep and look sign-off in one place`}
        action={
          <PrimaryButton onClick={() => setAddOpen(true)}>
            <Plus className="h-5 w-5" aria-hidden="true" /> Quick add
          </PrimaryButton>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients by name or skin type…"
          aria-label="Search clients"
          className="min-h-[50px] w-full rounded-2xl border border-input bg-card pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {filtered.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Users className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">No clients match “{query}”.</p>
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((client) => {
            const scanCount = scans.filter((scan) => scan.client_id === client.id).length;
            const look = looks.find((item) => item.client_id === client.id);
            return (
              <Link
                key={client.id}
                to="/pro/clients/$id"
                params={{ id: client.id }}
                className="glass block p-5 transition-transform hover:scale-[1.015]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display truncate text-lg font-bold">{client.client_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{client.contact_info}</p>
                  </div>
                  <Badge tone="primary">{client.skin_type}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="outline">
                    {scanCount} scan{scanCount === 1 ? "" : "s"}
                  </Badge>
                  {look && <StatusBadge status={look.status} />}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {addOpen && <QuickAddModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}
