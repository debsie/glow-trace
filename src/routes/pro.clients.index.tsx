import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Badge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  SectionCard,
  StatusBadge,
} from "@/components/ui/bits";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { useAppState } from "@/context/app-state";
import type { BlockedGate } from "@/lib/plans";
import { clientGate, PLANS } from "@/lib/plans";
import type { NewClientInput } from "@/lib/types";

export const Route = createFileRoute("/pro/clients/")({
  component: ClientsPage,
});

const QuickAddModal = ({ onClose }: { onClose: () => void }) => {
  const { addClient } = useAppState();
  const [form, setForm] = useState<NewClientInput>({
    client_name: "",
    contact_info: "",
    skin_type: "",
    notes: "",
  });

  const submit = () => {
    if (!form.client_name.trim()) {
      toast.error("Give your client a name first.");
      return;
    }
    const added = addClient(form);
    if ("allowed" in added) {
      // The roster filled up while the form was open; the page shows why.
      onClose();
      return;
    }
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
        className="surface w-full max-w-md space-y-3 rounded-b-none p-5 sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">Quick add client</h2>
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
  const { clients, activeClients, scans, looks, tier, archiveClient, restoreClient } =
    useAppState();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedGate | null>(null);

  const cap = PLANS[tier].limits.activeClients;
  const archived = clients.filter((client) => client.archived);

  const openAdd = () => {
    const gate = clientGate(tier, activeClients.length);
    if (!gate.allowed) {
      setBlocked(gate);
      return;
    }
    setBlocked(null);
    setAddOpen(true);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeClients;
    return activeClients.filter(
      (client) =>
        client.client_name.toLowerCase().includes(q) || client.skin_type.toLowerCase().includes(q),
    );
  }, [activeClients, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Roster"
        subtitle={`${activeClients.length} of ${cap} active clients · check-ins, prep and look sign-off in one place`}
        action={
          <PrimaryButton onClick={openAdd}>
            <Plus className="h-5 w-5" aria-hidden="true" /> Quick add
          </PrimaryButton>
        }
      />

      {blocked && <UpgradeCard gate={blocked} onDismiss={() => setBlocked(null)} />}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
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
            <p className="text-muted-foreground">
              {query.trim()
                ? `No clients match “${query}”.`
                : "No active clients yet — tap Quick add to start your roster."}
            </p>
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((client) => {
            const scanCount = scans.filter((scan) => scan.client_id === client.id).length;
            const look = looks.find((item) => item.client_id === client.id);
            return (
              <div key={client.id} className="surface p-5">
                <Link
                  to="/pro/clients/$id"
                  params={{ id: client.id }}
                  className="block rounded-xl transition-opacity hover:opacity-90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg font-semibold">
                        {client.client_name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {client.contact_info}
                      </p>
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
                <button
                  type="button"
                  onClick={() => {
                    archiveClient(client.id);
                    setBlocked(null);
                    toast.success(`${client.client_name} archived — that spot is open again.`);
                  }}
                  className="mt-3 inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Archive className="h-4 w-4" aria-hidden="true" /> Archive
                </button>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <SectionCard title={`Archived · ${archived.length}`}>
          <p className="mb-3 text-sm text-muted-foreground">
            Archived clients keep their notes and lookbooks, and don't count towards your {cap}{" "}
            active spots.
          </p>
          <ul className="space-y-2">
            {archived.map((client) => (
              <li
                key={client.id}
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4"
              >
                <span className="min-w-0 truncate text-sm font-semibold">{client.client_name}</span>
                <GhostButton
                  onClick={() => {
                    const gate = restoreClient(client.id);
                    if (gate.allowed) {
                      setBlocked(null);
                      toast.success(`${client.client_name} is active again.`);
                    } else {
                      setBlocked(gate);
                    }
                  }}
                >
                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> Restore
                </GhostButton>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {addOpen && <QuickAddModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}
