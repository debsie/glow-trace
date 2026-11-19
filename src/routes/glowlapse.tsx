import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GhostButton, PageHeader, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { scanScore } from "@/lib/beauty";
import { boundsOf, lapseCrop } from "@/lib/glowlapse";
import { shortDate } from "@/lib/progress";
import { pageHead } from "@/lib/seo";
import type { ScanRecord } from "@/lib/types";

export const Route = createFileRoute("/glowlapse")({
  head: () =>
    pageHead({
      title: "Glow-lapse — Glowtrace",
      description: "Your skin check-ins as a time-lapse, made on your phone.",
      path: "/glowlapse",
      noindex: true,
    }),
  component: GlowlapsePage,
});

const SIDE = 600;
const HOLD_MS = 900;
const FADE_MS = 350;

type Frame = { bitmap: ImageBitmap; date: string; score: number };

/** Each photo cropped to the same square around the face (the face guide finds it). */
const buildFrames = async (scans: readonly ScanRecord[]): Promise<Frame[]> => {
  const { findFace } = await import("@/lib/cv/guides");
  const frames: Frame[] = [];
  for (const scan of scans) {
    try {
      const image = new Image();
      image.src = scan.image_url;
      await image.decode();
      const canvas = Object.assign(document.createElement("canvas"), {
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;
      context.drawImage(image, 0, 0);
      const face = await findFace(context.getImageData(0, 0, canvas.width, canvas.height));
      const outline = face?.shapes(canvas.width, canvas.height)[0];
      const box = outline && outline.kind === "outline" ? boundsOf(outline.points) : null;
      const crop = lapseCrop(box, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas, crop.x, crop.y, crop.w, crop.h, {
        resizeWidth: SIDE,
        resizeHeight: SIDE,
        resizeQuality: "high",
      });
      frames.push({ bitmap, date: shortDate(scan.created_at), score: scanScore(scan) });
    } catch {
      // Skip a photo that can't be read.
    }
  }
  return frames;
};

const draw = (context: CanvasRenderingContext2D, frames: Frame[], index: number, fade: number) => {
  const current = frames[index];
  const previous = frames[(index - 1 + frames.length) % frames.length];
  if (!current) return;
  context.globalAlpha = 1;
  if (previous && fade < 1) context.drawImage(previous.bitmap, 0, 0);
  context.globalAlpha = fade;
  context.drawImage(current.bitmap, 0, 0);
  context.globalAlpha = 1;
  // Date and score on a flat band, in the app's typefaces.
  context.fillStyle = "rgba(0, 0, 0, 0.55)";
  context.fillRect(0, SIDE - 64, SIDE, 64);
  context.fillStyle = "#ffffff";
  context.font = "600 26px 'Bricolage Grotesque', system-ui, sans-serif";
  context.fillText(current.date, 24, SIDE - 24);
  context.font = "500 22px 'IBM Plex Mono', ui-monospace, monospace";
  const score = `Skin ${current.score}`;
  context.fillText(score, SIDE - 24 - context.measureText(score).width, SIDE - 24);
};

function GlowlapsePage() {
  const { scans } = useAppState();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const photos = scans
    .filter(
      (scan) =>
        scan.category === "skin" &&
        !scan.demo &&
        !scan.report?.quality.filtered &&
        scan.image_url.startsWith("blob:"),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  useEffect(() => {
    let cancelled = false;
    void buildFrames(photos).then((built) => {
      if (!cancelled) setFrames(built);
    });
    return () => {
      cancelled = true;
    };
    // Rebuild only when the set of photos changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map((scan) => scan.id).join()]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !frames?.length) return;
    if (!playing) {
      draw(context, frames, index, 1);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      draw(context, frames, index, reduced ? 1 : Math.min(1, elapsed / FADE_MS));
      if (elapsed >= HOLD_MS) setIndex((i) => (i + 1) % frames.length);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, index, playing]);

  const save = async () => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !frames?.length || typeof MediaRecorder === "undefined") return;
    setSaving(true);
    setPlaying(false);
    const type = ["video/mp4", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(element.captureStream(30), type ? { mimeType: type } : {});
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start();
    for (let i = 0; i < frames.length; i += 1) {
      const start = performance.now();
      while (performance.now() - start < HOLD_MS) {
        draw(context, frames, i, Math.min(1, (performance.now() - start) / FADE_MS));
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: type ?? "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: `glowtrace-glowlapse.${type === "video/mp4" ? "mp4" : "webm"}`,
    });
    link.click();
    URL.revokeObjectURL(url);
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Your glow-lapse"
        subtitle="Every skin check-in, lined up on your face. Made on this phone, kept on this phone."
      />
      {photos.length < 3 ? (
        <SectionCard>
          <p>Three skin check-ins and your glow-lapse appears here. One a day works best.</p>
          <Link
            to="/scan"
            search={{ area: "skin" }}
            className="mt-3 inline-flex min-h-[50px] items-center text-sm font-semibold text-primary"
          >
            Take a glow check
          </Link>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="overflow-hidden rounded-xl border border-border bg-secondary">
            <canvas
              ref={canvas}
              width={SIDE}
              height={SIDE}
              className="block h-auto w-full"
              aria-label={`Glow-lapse of ${frames?.length ?? photos.length} skin photos`}
            />
          </div>
          {frames === null ? (
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              Lining up your photos on this device.
            </p>
          ) : (
            <>
              <input
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={index}
                onChange={(event) => {
                  setPlaying(false);
                  setIndex(Number(event.target.value));
                }}
                aria-label="Choose a day"
                className="mt-4 w-full accent-[var(--primary)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => setPlaying((p) => !p)} disabled={saving}>
                  {playing ? (
                    <Pause className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Play className="h-5 w-5" aria-hidden="true" />
                  )}
                  {playing ? "Pause" : "Play"}
                </PrimaryButton>
                <GhostButton onClick={() => void (saving ? undefined : save())}>
                  <Download className="h-5 w-5" aria-hidden="true" />
                  {saving ? "Saving video" : "Save as video"}
                </GhostButton>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Saving makes a video file on this device. Nothing is uploaded; sharing it is your
                choice.
              </p>
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}
