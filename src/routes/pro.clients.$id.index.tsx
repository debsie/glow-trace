import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge, PageHeader, PrimaryButton, SectionCard, StatusBadge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { wellnessScore } from "@/lib/beauty";

export const Route = createFileRoute("/pro/clients/$id/")({
  component: ClientDetail,
});

const CATEGORY_LABEL: Record<string, string> = { skin: "Skin", hair: "Hair", nails: "Nails" };

function ClientDetail() {
  const { id } = Route.useParams();
  const { clients, scans, looks, sendLookForClient } = useAppState();
  const client = clients.find((item) => item.id === id);

  if (!client) {
    return (
      <div className="space-y-4">
        <PageHeader title="Client not found" />
        <SectionCard>
          <p className="text-muted-foreground">This client isn't in your roster. It may have been removed.</p>
          <Link to="/pro/clients" className="mt-3 inline-flex min-h-[50px] items-center font-semibold text-primary hover:underline">
            Back to roster
          </Link>
        </SectionCard>
      </div>
    );
  }

  const clientScans = scans
    .filter((scan) => scan.client_id === client.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const look = looks.find((item) => item.client_id === client.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.client_name}
        subtitle={client.contact_info}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pro/clients/$id/lookbook"
              params={{ id: client.id }}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-6 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary"
            >
              Open Lookbook
            </Link>
            <PrimaryButton
              disabled={!look || look.status !== "drafting"}
              onClick={() => {
                sendLookForClient(client.id);
                toast.success("Look sent — your client can now review and sign off.");
              }}
            >
              Send Look for Client Sign-off
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{client.skin_type}</Badge>
        {look && <StatusBadge status={look.status} />}
        {look && <Badge tone="outline"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{look.occasion}</Badge>}
        {look?.lighting.map((preset) => (
          <Badge key={preset} tone="accent">{preset}</Badge>
        ))}
      </div>

      {client.notes && (
        <SectionCard title="Client notes">
          <p className="text-sm text-muted-foreground">{client.notes}</p>
        </SectionCard>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Past scans">
          {clientScans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans on file yet — run one from the Scan tab.</p>
          ) : (
            <ul className="space-y-2">
              {clientScans.map((scan) => (
                <li key={scan.id} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                  <img src={scan.image_url} alt={`${CATEGORY_LABEL[scan.category]} scan`} width={44} height={44} loading="lazy" className="h-11 w-11 rounded-xl object-cover" />
                  <span className="flex-1 text-sm font-semibold">{CATEGORY_LABEL[scan.category]}</span>
                  <Badge tone={wellnessScore(scan.biomarkers) >= 65 ? "success" : "warning"}>
                    {wellnessScore(scan.biomarkers)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {look && (
          <div className="space-y-3">
            <SectionCard title="Assigned skin prep">
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                {look.skin_prep.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </SectionCard>
            <SectionCard title="Hair &amp; wig pairing">
              <p className="text-sm text-muted-foreground">{look.hair_wig_style}</p>
            </SectionCard>
            <SectionCard title="Nail art concept">
              <p className="text-sm text-muted-foreground">{look.nail_design}</p>
            </SectionCard>
            <Link
              to="/pro/clients/$id/lookbook"
              params={{ id: client.id }}
              className="glow-violet flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-5 font-semibold text-accent"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              Build the event lookbook <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
