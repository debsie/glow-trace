import { useId, useState } from "react";

import type { ProgressPoint } from "@/lib/progress";
import { shortDate } from "@/lib/progress";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const GRID = [0, 50, 100];

/**
 * One area's score over time: a single 2 px line in the primary colour, 8 px markers,
 * recessive grid, and a crosshair tooltip on hover or keyboard focus. Single series, so
 * the card title names it and there is no legend.
 */
export const ScoreChart = ({ points, label }: { points: ProgressPoint[]; label: string }) => {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const summary = `${label} score over time: ${points
    .map((p) => `${shortDate(p.date)} ${p.score}`)
    .join(", ")}`;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (score: number) => PAD.top + (1 - score / 100) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`).join(" ");
  const shown = active === null ? null : points[active];
  const slot = points.length > 1 ? plotW / (points.length - 1) : plotW;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby={titleId}
        onMouseLeave={() => setActive(null)}
      >
        {/* One string child: React 19 treats <title> specially and needs a single text node. */}
        <title id={titleId}>{summary}</title>
        {GRID.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
              className="readout fill-muted-foreground text-[14px]"
            >
              {value}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index === 0 || index === points.length - 1 || points.length <= 6 ? (
            <text
              key={`d-${point.id}`}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={
                points.length === 1
                  ? "middle"
                  : index === 0
                    ? "start"
                    : index === points.length - 1
                      ? "end"
                      : "middle"
              }
              className="fill-muted-foreground text-[14px]"
            >
              {shortDate(point.date)}
            </text>
          ) : null,
        )}
        {shown && active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="stroke-muted-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((point, index) => (
          <circle
            key={point.id}
            cx={x(index)}
            cy={y(point.score)}
            r={active === index ? 6 : 4}
            className="fill-primary stroke-card"
            strokeWidth={2}
          />
        ))}
        {/* Hit targets wider than the marks: one full-height column per point. */}
        {points.map((point, index) => (
          <rect
            key={`hit-${point.id}`}
            x={x(index) - slot / 2}
            y={PAD.top}
            width={slot}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${shortDate(point.date)}: score ${point.score}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            className="cursor-crosshair outline-none"
          />
        ))}
      </svg>
      {shown && active !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-card px-3 py-2 text-xs whitespace-nowrap"
          style={{
            left: `${(x(active) / WIDTH) * 100}%`,
            transform: `translateX(${active > points.length / 2 ? "-105%" : "5%"})`,
          }}
          aria-hidden="true"
        >
          <p className="text-muted-foreground">{shortDate(shown.date)}</p>
          <p className="readout text-sm text-foreground">{shown.score} / 100</p>
        </div>
      )}
    </div>
  );
};
