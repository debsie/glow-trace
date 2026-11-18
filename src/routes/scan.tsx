import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Droplets, ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  Badge,
  Gauge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from "@/components/ui/bits";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { CalibrationCard } from "@/components/calibration/calibration-card";
import { useAppState } from "@/context/app-state";
import { gaugesFor, scanScore, scoreVerdict } from "@/lib/beauty";
import { loadImageData, makeThumbnail } from "@/lib/cv/image";
import { analyzeBiomarkers, reportToBiomarkers } from "@/lib/cv/kernel";
import { parseBiomarkerReport } from "@/lib/cv/schemas";
import type { BiomarkerReport } from "@/lib/cv/types";
import { MOCK_BIOMARKERS } from "@/lib/mock-data";
import type { BlockedGate } from "@/lib/plans";
import { scanAllowance, scanGate, scansLeft } from "@/lib/plans";
import { pageHead } from "@/lib/seo";
import type { ScanRecord, ScanCategory } from "@/lib/types";

import scanSkin from "@/assets/scan-skin.jpg";
import scanHair from "@/assets/scan-hair.jpg";
import scanNails from "@/assets/scan-nails.jpg";

export const Route = createFileRoute("/scan")({
  head: () =>
    pageHead({
      title: "Skin, Hair & Nail Check-In — Glowtrace",
      description:
        "Take a photo and get a quick read on your skin, hair or nails, scored on your own device. 2 free check-ins a month; unlimited with Glow Pro for R59.",
      path: "/scan",
    }),
  component: ScanPage,
});

const CATEGORY_TABS: { id: ScanCategory; label: string; fallbackImage: string }[] = [
  { id: "skin", label: "Skin", fallbackImage: scanSkin },
  { id: "hair", label: "Hair", fallbackImage: scanHair },
  { id: "nails", label: "Nails", fallbackImage: scanNails },
];

const ANALYSIS_STEPS = ["Reading photo…", "Scoring indicators…", "Analysis complete"];

/** Keep the staged progress readable even when the kernel finishes in a few milliseconds. */
const MIN_ANALYSIS_MS = 900;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/* ---------- Upload zone: drag-and-drop with file-picker fallback ---------- */

const UploadZone = ({
  category,
  previewUrl,
  onFile,
}: {
  category: ScanCategory;
  previewUrl: string | null;
  onFile: (file: File) => void;
}) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fallback = CATEGORY_TABS.find((tab) => tab.id === category)?.fallbackImage ?? scanSkin;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
        dragOver ? "border-primary bg-primary/10" : "border-border bg-card/50"
      }`}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Selected ${category} photo preview`}
          className="mx-auto max-h-72 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="bg-primary flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="font-display text-lg font-semibold">Drop a {category} photo here</p>
          <p className="text-sm text-muted-foreground">
            Take one now or choose one from your gallery. Your photo is analysed on this device and
            never uploaded.
          </p>
        </div>
      )}
      {/* Camera: front camera for skin (a selfie), back camera for hair and nails. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture={category === "skin" ? "user" : "environment"}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Take a ${category} photo`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Choose a ${category} photo from your gallery`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap justify-center gap-2 p-4">
        <GhostButton onClick={() => cameraRef.current?.click()}>
          <Camera className="h-5 w-5" aria-hidden="true" />
          {previewUrl ? "Take another photo" : "Take a photo"}
        </GhostButton>
        <GhostButton onClick={() => galleryRef.current?.click()}>
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          {previewUrl ? "Choose another" : "Choose from gallery"}
        </GhostButton>
      </div>
    </div>
  );
};

/* ---------- Scan page ---------- */

function ScanPage() {
  const { scans, addScan, tier, usage, rewards } = useAppState();
  const [category, setCategory] = useState<ScanCategory>("skin");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // The chosen photo itself. Reading it directly avoids fetch() on a blob: link, which the
  // site's content security policy (connect-src) blocks in production.
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [makeupOpen, setMakeupOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedGate | null>(null);

  const allowance = scanAllowance(tier, rewards.bonusScans);
  const left = scansLeft(tier, usage.scans, rewards.bonusScans);

  const runAnalysis = () => {
    if (step !== null) return;
    // Check the plan limit before any work starts, so nobody waits for a result they can't see.
    const gate = scanGate(tier, usage.scans, rewards.bonusScans);
    if (!gate.allowed) {
      setBlocked(gate);
      return;
    }
    setBlocked(null);
    void analyse();
  };

  const analyse = async () => {
    setStep(0);
    const imageUrl =
      previewUrl ?? CATEGORY_TABS.find((tab) => tab.id === category)?.fallbackImage ?? scanSkin;
    const started = performance.now();
    let report: BiomarkerReport | null = null;
    let failure: string | null = null;
    let photo: Blob | undefined;
    try {
      const pixels = await loadImageData(photoFile ?? imageUrl);
      setStep(1);
      // Validate before the report enters app state, as with any other payload.
      report = parseBiomarkerReport(analyzeBiomarkers(category, pixels));
      // Keep a compact copy of the user's own photo for history; sample photos ship with the app.
      if (photoFile) photo = await makeThumbnail(photoFile).catch(() => undefined);
    } catch {
      failure = "We couldn't read that photo — try a JPEG or PNG";
    }
    await wait(Math.max(0, MIN_ANALYSIS_MS - (performance.now() - started)));
    setStep(2);
    await wait(250);
    setStep(null);

    const scored = report !== null && report.quality.usable && report.metrics.length > 0;
    const scan = addScan({
      category,
      biomarkers: scored && report ? reportToBiomarkers(report) : MOCK_BIOMARKERS[category],
      image_url: imageUrl,
      ...(report ? { report } : {}),
      ...(scored ? {} : { demo: true }),
      ...(photo ? { photo } : {}),
    });
    if ("allowed" in scan) {
      if (!scan.allowed) setBlocked(scan);
      return;
    }
    setResult(scan);
    if (scored) toast.success("Analysis complete. Indicators scored.");
    else toast(report?.quality.notice ?? failure ?? "Photo couldn't be scored");
  };

  const shown = result ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wellness Scan"
        subtitle="Upload a photo and read your skin, hair or nail indicators."
      />

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Scan category">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={category === tab.id}
            onClick={() => {
              setCategory(tab.id);
              setResult(null);
              setPreviewUrl(null);
              setPhotoFile(null);
            }}
            className={`min-h-[50px] rounded-2xl border text-base font-semibold transition-colors ${
              category === tab.id
                ? "bg-primary border-transparent text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <UploadZone
        category={category}
        previewUrl={previewUrl}
        onFile={(file) => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(file));
          setPhotoFile(file);
          setResult(null);
        }}
      />

      {blocked && <UpgradeCard gate={blocked} showInvite onDismiss={() => setBlocked(null)} />}

      <PrimaryButton onClick={runAnalysis} disabled={step !== null} className="w-full">
        <Droplets className="h-5 w-5" aria-hidden="true" />
        {step !== null ? ANALYSIS_STEPS[step] : "Run analysis"}
      </PrimaryButton>
      <p aria-live="polite" className="sr-only">
        {step !== null ? ANALYSIS_STEPS[step] : "Ready to analyze."}
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {allowance === null
          ? "Unlimited check-ins on your plan."
          : `${left} of ${allowance} free check-ins left this month.`}{" "}
        {allowance !== null && (
          <Link to="/pricing" className="font-semibold text-primary hover:underline">
            Go unlimited
          </Link>
        )}
      </p>

      {shown && (
        <SectionCard title={`${category} analysis`}>
          <div aria-live="polite">
            {shown.demo && (
              <p
                className="mb-4 rounded-2xl border border-warning px-4 py-3 text-sm text-foreground"
                role="status"
              >
                <span className="font-semibold text-warning">Not scored. </span>
                {shown.report?.quality.notice ?? "We couldn't read that photo"}. The values below
                are sample values, not your results.
              </p>
            )}
            {!shown.demo && shown.report?.quality.warning && (
              <p
                className="mb-4 rounded-2xl border border-border px-4 py-3 text-sm text-foreground"
                role="status"
              >
                <span className="font-semibold">Check the light. </span>
                {shown.report.quality.warning}.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-semibold">
                  {scanScore(shown)}
                  <span className="text-base text-muted-foreground"> / 100</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone={scanScore(shown) >= 65 ? "success" : "warning"}>
                    {scoreVerdict(scanScore(shown))}
                  </Badge>
                  {shown.report && !shown.demo && (
                    <Badge tone="accent">MojoCV v1 · on-device</Badge>
                  )}
                </div>
              </div>
              <img
                src={shown.image_url}
                alt={`Analyzed ${category} photo`}
                width={72}
                height={72}
                loading="lazy"
                className="h-18 w-18 rounded-2xl object-cover"
                style={{ height: 72, width: 72 }}
              />
            </div>
            <div className="mt-4 space-y-4">
              {shown.report && !shown.demo
                ? shown.report.metrics.map((metric) => (
                    <Gauge
                      key={metric.key}
                      label={metric.label}
                      value={metric.value}
                      caption={`${metric.higherMeans === "better" ? "Higher is better." : "Higher means more."} ${metric.description}`}
                    />
                  ))
                : gaugesFor(category, shown.biomarkers).map((gauge) => (
                    <Gauge
                      key={gauge.key}
                      label={gauge.label}
                      value={gauge.value}
                      caption={gauge.caption}
                    />
                  ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/agent" className="contents">
              <GhostButton>
                Ask Your Agent
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </GhostButton>
            </Link>
            <Link to="/progress" className="contents">
              <GhostButton>Compare Past Scans</GhostButton>
            </Link>
            <Link to="/routine" className="contents">
              <GhostButton>
                Daily Care Routine
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </GhostButton>
            </Link>
            <GhostButton onClick={() => setMakeupOpen((open) => !open)}>
              Makeup Base &amp; Prep
            </GhostButton>
          </div>

          {makeupOpen && (
            <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <p className="font-display font-semibold text-accent">Makeup Base &amp; Prep</p>
              <p className="mt-1 text-sm text-foreground">
                Base: <strong>Neutral Cool — Satin Finish</strong>, buildable medium coverage over a
                hydrated, primed barrier.
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                <li>Hydrating barrier cream, 10-minute melt</li>
                <li>Silicone-free primer on the T-zone</li>
                <li>Colour-correct any lingering redness before foundation</li>
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      {shown && !shown.demo && shown.report && <CalibrationCard report={shown.report} />}
    </div>
  );
}
