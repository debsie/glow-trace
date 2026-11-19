import { useState } from "react";

import type { Detections } from "@/lib/cv/detections";

/**
 * The photo with what Glowtrace looked at drawn over it: thin token-coloured outlines that draw
 * in once (still under reduced motion), and small labels. Shapes are 0-1 of the photo.
 */
export const DetectionView = ({
  src,
  detections,
  alt,
}: {
  src: string;
  detections: Detections;
  alt: string;
}) => {
  const pct = (value: number) => `${(Math.min(1, Math.max(0, value)) * 100).toFixed(2)}%`;
  // Drawn in the photo's own pixels so lines keep an even width and the draw-in dash is exact.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const w = size?.w ?? 1;
  const h = size?.h ?? 1;
  const line = Math.max(w, h) / 320;
  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-border bg-secondary">
        <img
          src={src}
          alt={alt}
          className="block h-auto w-full"
          onLoad={(event) =>
            setSize({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })
          }
        />
        {size && (
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {detections.shapes.map((shape, index) => {
              if (shape.kind === "outline") {
                const d = `M${shape.points.map((p) => `${p.x * w} ${p.y * h}`).join(" L")} Z`;
                return (
                  <path
                    key={index}
                    d={d}
                    pathLength={1}
                    className={`detect-line ${shape.role === "area" ? "text-primary" : "text-accent"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={shape.role === "area" ? line * 1.4 : line}
                    strokeLinejoin="round"
                    style={{ animationDelay: `${index * 0.12}s` }}
                  />
                );
              }
              if (shape.kind === "box") {
                return (
                  <rect
                    key={index}
                    x={shape.x * w}
                    y={shape.y * h}
                    width={shape.w * w}
                    height={shape.h * h}
                    rx={Math.min(shape.w * w, shape.h * h) * 0.25}
                    pathLength={1}
                    className="detect-line text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={line * 1.4}
                    style={{ animationDelay: `${index * 0.12}s` }}
                  />
                );
              }
              return (
                <line
                  key={index}
                  x1={0}
                  x2={w}
                  y1={shape.y * h}
                  y2={shape.y * h}
                  pathLength={1}
                  className={
                    shape.role === "end"
                      ? "detect-line text-primary"
                      : "detect-label text-muted-foreground"
                  }
                  stroke="currentColor"
                  strokeWidth={shape.role === "end" ? line * 1.4 : line * 0.8}
                  strokeDasharray={shape.role === "end" ? undefined : `${line * 3} ${line * 4}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              );
            })}
          </svg>
        )}
        {detections.shapes.map((shape, index) => {
          if (!("label" in shape) || !shape.label) return null;
          const at =
            shape.kind === "box"
              ? { left: pct(shape.x), top: pct(shape.y + shape.h) }
              : shape.kind === "level"
                ? { left: "0.75rem", top: pct(shape.y) }
                : {
                    left: pct(Math.max(...shape.points.map((p) => p.x))),
                    top: pct(shape.points.reduce((sum, p) => sum + p.y, 0) / shape.points.length),
                  };
          const strong = shape.kind === "level" ? shape.role === "end" : true;
          return (
            <span
              key={`label-${index}`}
              className={`detect-label absolute -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                strong
                  ? "border-primary bg-background text-foreground"
                  : "border-border bg-background text-muted-foreground"
              } ${shape.kind === "outline" ? "ml-2" : shape.kind === "box" ? "mt-3" : ""}`}
              style={at}
            >
              {shape.label}
            </span>
          );
        })}
      </div>
      <figcaption className="text-xs text-muted-foreground">{detections.caption}</figcaption>
    </figure>
  );
};
