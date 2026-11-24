import { Camera, Check, ImageIcon, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GhostButton, PrimaryButton } from "@/components/ui/bits";
import { measureSubject } from "@/lib/cv/guides";
import type { ScanReference } from "@/lib/cv/consistency";
import {
  centreLook,
  compareToReference,
  loadReferences,
  matchHint,
  saveReference,
} from "@/lib/cv/consistency";
import { frameHint, lightTip } from "@/lib/cv/kernel";
import { subjectHint, subjectKind } from "@/lib/cv/subject-check";
import type { Overlay, Shot } from "@/lib/scan-session";
import type { ScanCategory } from "@/lib/types";

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
  "hair-length": <rect x="22" y="6" width="56" height="88" rx="6" />,
};

const PREVIEW_PX = 160;
// The guides need more pixels than the light check to find a face, hand or hair.
const DETECT_PX = 320;

export const GuidedCamera = ({
  category,
  shot,
  onCapture,
  onCancel,
}: {
  category: ScanCategory;
  shot: Shot;
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
}) => {
  const video = useRef<HTMLVideoElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<string | undefined>("Starting the camera");
  const [tip, setTip] = useState<string | undefined>(undefined);
  // Undefined: in frame, or the guide is unavailable (the camera then works without it).
  const [subject, setSubject] = useState<string | undefined>("Getting the guide ready");
  const [waitedLong, setWaitedLong] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Steadier scans: last time's distance, brightness and light colour for this shot, and now's.
  const [reference, setReference] = useState<ScanReference | null>(null);
  const [light, setLight] = useState<{ luma: number; warmth: number } | null>(null);
  const [faceShare, setFaceShare] = useState<number | null>(null);
  useEffect(() => setReference(loadReferences()[shot.id] ?? null), [shot.id]);

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
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      setLight(centreLook(frame));
      const blocking = frameHint(frame, Math.min(el.videoWidth, el.videoHeight));
      setHint(blocking);
      setTip(blocking ? undefined : lightTip(frame));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  // Look for the face, hand or hair about once a second, on this device only.
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const kind = subjectKind(category);
    let busy = false;
    let stopped = false;
    const timer = window.setInterval(() => {
      const el = video.current;
      if (busy || !el || el.videoWidth === 0) return;
      const scale = DETECT_PX / Math.max(el.videoWidth, el.videoHeight);
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(el, 0, 0, canvas.width, canvas.height);
      busy = true;
      void measureSubject(kind, context.getImageData(0, 0, canvas.width, canvas.height))
        .then((measure) => {
          if (stopped) return;
          setSubject(measure ? subjectHint(shot.id, measure) : undefined);
          setFaceShare(measure?.kind === "face" && measure.found ? measure.share : null);
        })
        .finally(() => {
          busy = false;
        });
    }, 900);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [category, shot.id]);

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
    // Remember how this photo was taken, so the next scan of this shot can match it.
    if (light) saveReference(shot.id, { share: faceShare ?? reference?.share ?? 0, ...light });
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.92);
  }, [onCapture, shot.camera, shot.id, light, faceShare, reference]);

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

  // Distance only for faces (the guide measures it); light and colour for every shot.
  const match =
    reference && light
      ? compareToReference(
          { share: faceShare ?? reference.share, ...light },
          faceShare === null ? { ...reference, share: reference.share } : reference,
        )
      : null;
  const steady = match ? matchHint(match) : undefined;
  const blocking = hint ?? subject ?? steady;
  const ready = blocking === undefined;

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
                className={ready ? "stroke-camera-guide" : "stroke-camera-guide/60"}
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
              {tip ? `Good to go. Tip: ${tip}.` : "Ready. Hold still and take the photo."}
            </span>
          ) : (
            <span className="text-muted-foreground">{blocking}</span>
          )}
        </p>
        {match && !failed && (
          <ul
            className="flex flex-wrap justify-center gap-2 text-xs"
            aria-label="Compared with your last photo"
          >
            <li className="text-muted-foreground">Same as last time:</li>
            {(
              [
                ["Distance", faceShare === null ? "ok" : match.distance],
                ["Light", match.light],
                ["Colour", match.colour],
              ] as const
            ).map(([label, state]) => (
              <li
                key={label}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold ${
                  state === "ok"
                    ? "border-success text-success"
                    : "border-border text-muted-foreground"
                }`}
              >
                {label}
                {state === "ok" && <Check className="ml-1 inline h-3 w-3" aria-hidden="true" />}
                <span className="sr-only">
                  {state === "ok" ? " matches" : " doesn't match yet"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {shot.steps[0]}. No filters or beauty mode.
        </p>
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
