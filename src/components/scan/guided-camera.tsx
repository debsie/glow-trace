import { Camera, ImageIcon, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GhostButton, PrimaryButton } from "@/components/ui/bits";
import { frameHint } from "@/lib/cv/kernel";
import type { Overlay, Shot } from "@/lib/scan-session";

/**
 * Live camera for one shot: a framing outline, a live quality check (the same gate a scan uses),
 * and a shutter that waits until the photo would score. Falls back to the gallery if the camera
 * is unavailable or refused. Frames never leave the device.
 */

const FRAMES: Record<Overlay, React.ReactElement> = {
  face: <ellipse cx="50" cy="46" rx="26" ry="34" />,
  "hand-flat": <rect x="14" y="20" width="72" height="60" rx="6" />,
  thumb: <rect x="32" y="24" width="36" height="44" rx="6" />,
  "hair-lengths": <rect x="18" y="12" width="64" height="76" rx="6" />,
  "hair-crown": <circle cx="50" cy="50" r="34" />,
  "hair-ends": <rect x="26" y="30" width="48" height="40" rx="6" />,
};

const PREVIEW_PX = 160;

export const GuidedCamera = ({
  shot,
  onCapture,
  onCancel,
}: {
  shot: Shot;
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
}) => {
  const video = useRef<HTMLVideoElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<string | undefined>("Starting the camera");
  const [waitedLong, setWaitedLong] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: shot.camera, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
      })
      .catch(() => setFailed(true));
    if (!navigator.mediaDevices) setFailed(true);
    const slow = window.setTimeout(() => setWaitedLong(true), 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(slow);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [shot.camera]);

  // Check a small preview frame about twice a second.
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const timer = window.setInterval(() => {
      const el = video.current;
      if (!el || el.videoWidth === 0) return;
      const scale = PREVIEW_PX / Math.max(el.videoWidth, el.videoHeight);
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(el, 0, 0, canvas.width, canvas.height);
      setHint(frameHint(context.getImageData(0, 0, canvas.width, canvas.height)));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const capture = useCallback(() => {
    const el = video.current;
    if (!el || el.videoWidth === 0) return;
    const canvas = Object.assign(document.createElement("canvas"), {
      width: el.videoWidth,
      height: el.videoHeight,
    });
    const context = canvas.getContext("2d");
    if (!context) return;
    if (shot.camera === "user") {
      // Save what the person saw: the preview is mirrored for selfies.
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(el, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.92);
  }, [onCapture, shot.camera]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      capture();
      return;
    }
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, capture]);

  const ready = hint === undefined;

  // Rendered on <body>: the page wrapper animates, and a transformed parent would trap a fixed
  // element inside it instead of covering the screen.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Take the ${shot.title.toLowerCase()} photo`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="font-display text-lg font-semibold">{shot.title}</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close the camera"
          className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-secondary">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-semibold">The camera isn't available</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Allow camera access in your browser settings, or choose a photo you have already
              taken.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              className={`h-full w-full object-cover ${shot.camera === "user" ? "-scale-x-100" : ""}`}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <g
                fill="none"
                strokeWidth="0.8"
                strokeDasharray="3 2"
                className={ready ? "stroke-primary-foreground" : "stroke-primary-foreground/60"}
              >
                {FRAMES[shot.overlay]}
              </g>
            </svg>
            {countdown !== null && (
              <span
                className="absolute inset-0 flex items-center justify-center font-display text-7xl font-semibold text-primary-foreground"
                aria-live="assertive"
              >
                {countdown}
              </span>
            )}
          </>
        )}
      </div>

      <div className="space-y-3 px-4 py-4">
        <p className="min-h-6 text-center text-sm" aria-live="polite">
          {failed ? (
            ""
          ) : ready ? (
            <span className="font-semibold text-foreground">
              Ready. Hold still and take the photo.
            </span>
          ) : (
            <span className="text-muted-foreground">{hint}</span>
          )}
        </p>
        <p className="text-center text-xs text-muted-foreground">{shot.steps[0]}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {!failed && (
            <PrimaryButton onClick={capture} disabled={!ready && !waitedLong}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              {ready || !waitedLong ? "Take photo" : "Take photo anyway"}
            </PrimaryButton>
          )}
          {!failed && shot.id === "crown" && (
            <GhostButton onClick={() => setCountdown(3)}>
              <Timer className="h-5 w-5" aria-hidden="true" /> 3-second timer
            </GhostButton>
          )}
          <GhostButton onClick={() => gallery.current?.click()}>
            <ImageIcon className="h-5 w-5" aria-hidden="true" /> From gallery
          </GhostButton>
        </div>
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a photo from your gallery"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onCapture(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>,
    document.body,
  );
};
