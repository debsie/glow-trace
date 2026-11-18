import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, HardDrive, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Badge,
  BUTTON_GHOST,
  GhostButton,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { useAuth } from "@/context/auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Your Data and Privacy — Glowtrace",
      description:
        "See what Glowtrace keeps on your device, download a copy of it, or delete all of it.",
      path: "/privacy",
      noindex: true,
    }),
  component: PrivacyPage,
});

const PROMISES = [
  { title: "Photos stay here", body: "Analysed in this browser. Never uploaded." },
  { title: "No tracking", body: "No ad pixels, no analytics, no data sales." },
  { title: "Yours to take or erase", body: "Download it all, or delete it all, any time." },
];

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function PrivacyPage() {
  const { scans, clients, looks, shelfCount, storageStatus, exportData, deleteAllData } =
    useAppState();
  const { access, signOut, deleteAccount } = useAuth();
  const member = access.kind === "member" || access.kind === "waitlisted";
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  const rows = [
    { label: "Scans", value: scans.length },
    {
      label: "Photos kept",
      value: scans.filter((scan) => scan.image_url.startsWith("blob:")).length,
    },
    { label: "Shelf products", value: shelfCount },
    { label: "Clients", value: clients.length },
    { label: "Lookbooks", value: looks.length },
  ];

  const onExport = async () => {
    setBusy("export");
    try {
      downloadJson(
        await exportData(),
        `glowtrace-data-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success("Your data is downloading.");
    } catch {
      toast.error("Couldn't prepare the download. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    setBusy("delete");
    try {
      // Account first: if that fails, nothing is lost and the person can try again.
      if (member) {
        const result = await deleteAccount();
        if (!result.ok) {
          toast.error(result.reason);
          return;
        }
      }
      await deleteAllData();
      toast.success(
        member
          ? "Your account and everything on this device have been deleted."
          : "Everything on this device has been deleted.",
      );
    } catch {
      toast.error(
        "Couldn't delete everything. Try again, or clear this site's data in your browser.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Your Data"
        subtitle="What Glowtrace keeps, where it lives, and how to take it or erase it."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="surface p-5">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-semibold">{promise.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{promise.body}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Stored on this device"
        action={
          <Badge
            tone={
              storageStatus === "saved"
                ? "success"
                : storageStatus === "loading"
                  ? "default"
                  : "warning"
            }
          >
            <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
            {storageStatus === "saved"
              ? "Saving on this device"
              : storageStatus === "loading"
                ? "Loading"
                : "Not saving"}
          </Badge>
        }
      >
        {storageStatus === "unavailable" && (
          <p className="mb-4 text-sm text-muted-foreground" role="status">
            This browser is blocking storage (often a private window), so nothing is being kept.
            Your scans will be gone when you close the tab.
          </p>
        )}
        <dl className="divide-y divide-border" aria-live="polite">
          {rows.map((row) => (
            <div key={row.label} className="flex min-h-[48px] items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="readout text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Kept in this browser's storage only. Another browser or device starts empty. Your plan and
          invite code are stored here too.
        </p>
      </SectionCard>

      {member && (
        <SectionCard title="Your account">
          <dl className="divide-y divide-border">
            <div className="flex min-h-[48px] items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Signed in as</dt>
              <dd className="text-sm font-semibold text-foreground">{access.email}</dd>
            </div>
            <div className="flex min-h-[48px] items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Stored in your account</dt>
              <dd className="text-sm text-foreground">Email and name only</dd>
            </div>
          </dl>
          <button type="button" onClick={() => void signOut()} className={`${BUTTON_GHOST} mt-4`}>
            <LogOut className="h-5 w-5" aria-hidden="true" /> Sign Out
          </button>
        </SectionCard>
      )}

      <SectionCard title="Download my data">
        <p className="text-sm text-muted-foreground">
          One file with every scan and its scores, your photos, shelf, clients and lookbooks. Keep
          it, or open it in any text editor.
        </p>
        <PrimaryButton className="mt-4" onClick={onExport} disabled={busy !== null}>
          <Download className="h-5 w-5" aria-hidden="true" />
          {busy === "export" ? "Preparing…" : "Download My Data"}
        </PrimaryButton>
      </SectionCard>

      <SectionCard title="Delete everything">
        <p className="text-sm text-muted-foreground">
          Erases every scan, photo, client, lookbook and setting on this device
          {member ? ", and deletes your Glowtrace account" : ""}. This can't be undone, so download
          a copy first if you want one.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={busy !== null}
              className={`${BUTTON_GHOST} mt-4 border-destructive text-destructive`}
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              {busy === "delete" ? "Deleting…" : "Delete Everything"}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-xl border-border bg-card shadow-none">
            <AlertDialogTitle className="font-display text-xl font-semibold">
              Delete everything on this device?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {scans.length} scans, their photos, {clients.length} clients and {looks.length}{" "}
              lookbooks will be erased for good. Your plan goes back to Free.
            </AlertDialogDescription>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel asChild>
                <GhostButton>Keep My Data</GhostButton>
              </AlertDialogCancel>
              <AlertDialogCancel asChild>
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-destructive px-6 text-base font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" /> Delete Everything
                </button>
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SectionCard>

      <p className="text-center text-sm text-muted-foreground">
        Questions about privacy?{" "}
        <Link to="/pricing" className="font-semibold text-primary hover:underline">
          Read the FAQ
        </Link>
        .
      </p>
    </div>
  );
}
