import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, ImageIcon, Sparkles } from "lucide-react";
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
import { useAppState } from "@/context/app-state";
import { gaugesFor, scoreVerdict, wellnessScore } from "@/lib/beauty";
import { MOCK_BIOMARKERS } from "@/lib/mock-data";
import type { DiagnosticScan, ScanCategory } from "@/lib/types";

import scanSkin from "@/assets/scan-skin.jpg";
import scanHair from "@/assets/scan-hair.jpg";
import scanNails from "@/assets/scan-nails.jpg";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — Diagnostic Scan" },
      {
        name: "description",
        content:
          "Upload a photo and run an AI analysis of skin, hair or nails with biomarker gauges.",
      },
      { property: "og:title", content: "Glowtrace AI — Diagnostic Scan" },
      {
        property: "og:description",
        content:
          "Upload a photo and run an AI analysis of skin, hair or nails with biomarker gauges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanPage,
});

const CATEGORY_TABS: { id: ScanCategory; label: string; fallbackImage: string }[] = [
  { id: "skin", label: "Skin", fallbackImage: scanSkin },
  { id: "hair", label: "Hair", fallbackImage: scanHair },
  { id: "nails", label: "Nails", fallbackImage: scanNails },
];

const ANALYSIS_STEPS = ["Uploading image…", "Detecting biomarkers…", "Scoring results…"];

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
  const inputRef = useRef<HTMLInputElement>(null);
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
      className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-colors ${
        dragOver ? "border-primary bg-primary/10" : "border-border bg-card/50"
      }`}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Selected ${category} photo preview`}
          className="mx-auto max-h-72 w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="ai-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-white">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="font-display text-lg font-bold">Drop a {category} photo here</p>
          <p className="text-sm text-muted-foreground">
            Or use your camera roll — analysis runs on-device in this preview.
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={`Upload a ${category} photo`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div className="flex flex-wrap justify-center gap-2 p-4">
        <GhostButton onClick={() => inputRef.current?.click()}>
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          {previewUrl ? "Choose another photo" : "Browse files"}
        </GhostButton>
      </div>
    </div>
  );
};

/* ---------- Scan page ---------- */

function ScanPage() {
  const { scans, addScan } = useAppState();
  const [category, setCategory] = useState<ScanCategory>("skin");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [result, setResult] = useState<DiagnosticScan | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [makeupOpen, setMakeupOpen] = useState(false);

  const runAnalysis = () => {
    if (step !== null) return;
    setStep(0);
    const timers = ANALYSIS_STEPS.map((_, index) =>
      window.setTimeout(() => setStep(index), 450 * (index + 1)),
    );
    window.setTimeout(() => {
      timers.forEach((timer) => window.clearTimeout(timer));
      setStep(null);
      const scan = addScan({
        category,
        biomarkers: MOCK_BIOMARKERS[category],
        image_url:
          previewUrl ?? CATEGORY_TABS.find((tab) => tab.id === category)?.fallbackImage ?? scanSkin,
      });
      setResult(scan);
      toast.success("Analysis complete — biomarkers scored.");
    }, 1500);
  };

  const shown = result ?? null;
  const pastScans = scans
    .filter((scan) => scan.category === category)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostic Scan"
        subtitle="Capture, upload and analyze — AI scores five biomarkers per category."
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
            }}
            className={`min-h-[50px] rounded-2xl border text-base font-bold transition-colors ${
              category === tab.id
                ? "ai-gradient border-transparent text-white"
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
          setResult(null);
        }}
      />

      <PrimaryButton onClick={runAnalysis} disabled={step !== null} className="w-full">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        {step !== null ? ANALYSIS_STEPS[step] : "Run AI Analysis"}
      </PrimaryButton>
      <p aria-live="polite" className="sr-only">
        {step !== null ? ANALYSIS_STEPS[step] : "Ready to analyze."}
      </p>

      {shown && (
        <SectionCard title={`${category} analysis`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-bold">
                {wellnessScore(shown.biomarkers)}
                <span className="text-base text-muted-foreground"> / 100</span>
              </p>
              <Badge tone={wellnessScore(shown.biomarkers) >= 65 ? "success" : "warning"}>
                {scoreVerdict(wellnessScore(shown.biomarkers))}
              </Badge>
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
            {gaugesFor(category, shown.biomarkers).map((gauge) => (
              <Gauge key={gauge.key} label={gauge.label} value={gauge.value} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <GhostButton onClick={() => setCompareOpen((open) => !open)}>
              Compare Past Scans
            </GhostButton>
            <Link to="/routine" className="contents">
              <GhostButton>
                Daily Treatment Routine
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </GhostButton>
            </Link>
            <GhostButton onClick={() => setMakeupOpen((open) => !open)}>
              Makeup Base &amp; Prep
            </GhostButton>
          </div>

          {compareOpen && (
            <div className="mt-4 space-y-2">
              {pastScans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
                >
                  <img
                    src={scan.image_url}
                    alt="Past scan"
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                  <span className="flex-1 text-sm">
                    {new Date(scan.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge tone={wellnessScore(scan.biomarkers) >= 65 ? "success" : "warning"}>
                    {wellnessScore(scan.biomarkers)}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {makeupOpen && (
            <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <p className="font-display font-bold text-accent">Makeup Base &amp; Prep</p>
              <p className="mt-1 text-sm text-foreground">
                Base: <strong>Neutral Cool — Satin Finish</strong>, buildable medium coverage over a
                hydrated, primed barrier.
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                <li>Hydrating barrier cream, 10-minute melt</li>
                <li>Silicone-free primer on the T-zone</li>
                <li>Color-correct any lingering erythema before foundation</li>
              </ul>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
