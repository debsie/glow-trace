import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/hooks/use-in-view";
import type { Overlay } from "@/lib/scan-session";

/**
 * Looping illustrations that show how to take each photo. Pure SVG and CSS (animations in
 * styles.css, `mg-` classes), token-coloured, still under reduced motion. No video files.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Phone = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-17" y="-30" width="34" height="60" rx="6" {...STROKE} className="text-foreground" />
    <circle cx="0" cy="-23" r="1.6" className="fill-foreground" />
  </g>
);

const Sun = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`} className="text-accent">
    <circle r="7" {...STROKE} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <line
        key={angle}
        x1="0"
        y1="-11"
        x2="0"
        y2="-15"
        transform={`rotate(${angle})`}
        {...STROKE}
        className="mg-pulse"
      />
    ))}
  </g>
);

const Face = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <rect
      x="12"
      y="20"
      width="40"
      height="56"
      rx="3"
      {...STROKE}
      className="text-muted-foreground"
    />
    <line x1="32" y1="20" x2="32" y2="76" {...STROKE} className="text-muted-foreground" />
    <Sun x={32} y={100} />
    <g className="mg-light">
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1="56"
          y1={34 + i * 14}
          x2="92"
          y2={44 + i * 14}
          {...STROKE}
          className="text-accent"
        />
      ))}
    </g>
    <circle cx="140" cy="70" r="30" {...STROKE} className="text-muted-foreground" />
    <path d="M100 160 C104 124 176 124 180 160" {...STROKE} className="text-muted-foreground" />
    <ellipse
      cx="140"
      cy="70"
      rx="36"
      ry="44"
      {...STROKE}
      strokeDasharray="6 6"
      className="mg-frame text-primary"
    />
    <g className="mg-phone-rise">
      <Phone x={210} y={95} />
    </g>
  </svg>
);

const fingers = [
  { x: 102, rotate: -14 },
  { x: 116, rotate: -5 },
  { x: 130, rotate: 5 },
  { x: 144, rotate: 14 },
];

const HandFlat = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <line x1="20" y1="150" x2="220" y2="150" {...STROKE} className="text-muted-foreground" />
    <g className="text-muted-foreground">
      <rect x="100" y="92" width="56" height="50" rx="14" {...STROKE} />
      {fingers.map((finger, index) => (
        <g
          key={finger.x}
          className={`mg-spread-${index}`}
          style={{ transformOrigin: `${finger.x + 6}px 96px` }}
        >
          <rect x={finger.x} y="44" width="12" height="54" rx="6" {...STROKE} />
          <rect
            x={finger.x + 2}
            y="46"
            width="8"
            height="10"
            rx="3"
            className="mg-nail fill-primary/30"
          />
        </g>
      ))}
      <path d="M100 118 C86 112 80 98 84 90" {...STROKE} />
    </g>
    <rect
      x="88"
      y="34"
      width="80"
      height="72"
      rx="6"
      {...STROKE}
      strokeDasharray="5 5"
      className="mg-frame text-primary"
    />
    <line x1="92" y1="40" x2="164" y2="40" {...STROKE} className="mg-scan text-primary" />
    <g className="mg-phone-drop">
      <Phone x={128} y={2} />
    </g>
  </svg>
);

const Thumb = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <line x1="20" y1="150" x2="220" y2="150" {...STROKE} className="text-muted-foreground" />
    <g className="mg-turn text-muted-foreground" style={{ transformOrigin: "120px 120px" }}>
      <rect x="96" y="100" width="48" height="44" rx="12" {...STROKE} />
      <rect x="128" y="66" width="16" height="42" rx="8" {...STROKE} />
      <rect x="131" y="68" width="10" height="11" rx="3" className="mg-nail fill-primary/30" />
    </g>
    <rect
      x="112"
      y="52"
      width="48"
      height="48"
      rx="6"
      {...STROKE}
      strokeDasharray="5 5"
      className="mg-frame text-primary"
    />
    <g className="mg-phone-drop">
      <Phone x={136} y={2} />
    </g>
  </svg>
);

const HairLengths = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <Sun x={24} y={40} />
    <g className="text-muted-foreground">
      <circle cx="100" cy="60" r="26" {...STROKE} />
      <path d="M60 160 C64 120 136 120 140 160" {...STROKE} />
    </g>
    <g className="mg-swing text-foreground" style={{ transformOrigin: "112px 40px" }}>
      {[0, 6, 12].map((offset) => (
        <path
          key={offset}
          d={`M${104 + offset} 38 C${140 + offset} 60 ${126 + offset} 110 ${150 + offset} 138`}
          {...STROKE}
        />
      ))}
    </g>
    <rect
      x="128"
      y="92"
      width="52"
      height="56"
      rx="6"
      {...STROKE}
      strokeDasharray="5 5"
      className="mg-frame text-primary"
    />
    <g className="mg-phone-side">
      <Phone x={204} y={118} />
    </g>
  </svg>
);

const HairLength = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <g className="text-muted-foreground">
      <circle cx="90" cy="30" r="15" {...STROKE} />
      <path d="M62 66 C70 54 110 54 118 66 L122 150 L58 150 Z" {...STROKE} />
    </g>
    <g className="mg-swing text-foreground" style={{ transformOrigin: "90px 24px" }}>
      {[-8, -3, 2, 7].map((offset) => (
        <path
          key={offset}
          d={`M${90 + offset} 22 C${88 + offset} 60 ${92 + offset} 90 ${90 + offset} 112`}
          {...STROKE}
        />
      ))}
    </g>
    <g className="text-primary">
      {[62, 88, 112, 136].map((y) => (
        <line
          key={y}
          x1="128"
          y1={y}
          x2="140"
          y2={y}
          {...STROKE}
          strokeDasharray="3 3"
          className="mg-frame"
        />
      ))}
    </g>
    <g className="mg-phone-side">
      <Phone x={200} y={92} />
    </g>
  </svg>
);

const HairCrown = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <g className="text-muted-foreground">
      <circle cx="120" cy="92" r="50" {...STROKE} />
      {[-30, -15, 15, 30].map((x) => (
        <path
          key={x}
          d={`M${120 + x} 46 C${120 + x * 1.3} 80 ${120 + x * 1.3} 110 ${120 + x} 138`}
          {...STROKE}
        />
      ))}
    </g>
    <path d="M120 44 L120 140" {...STROKE} strokeDasharray="100" className="mg-part text-primary" />
    <g className="mg-phone-hover">
      <Phone x={120} y={92} />
    </g>
    <text x="196" y="40" className="mg-count fill-primary font-mono text-[18px]">
      3
    </text>
  </svg>
);

const HairEnds = () => (
  <svg viewBox="0 0 240 170" className="h-full w-full" aria-hidden="true">
    <rect
      x="70"
      y="30"
      width="110"
      height="120"
      rx="3"
      {...STROKE}
      className="text-muted-foreground"
    />
    <g className="mg-pinch text-foreground">
      {[-12, -6, 0, 6, 12].map((x) => (
        <path
          key={x}
          d={`M${80 + x} 20 C${100 + x} 60 ${118 + x / 3} 90 ${125 + x / 4} 120`}
          {...STROKE}
        />
      ))}
      <circle cx="104" cy="70" r="7" {...STROKE} className="text-muted-foreground" />
      <circle cx="116" cy="64" r="7" {...STROKE} className="text-muted-foreground" />
    </g>
    <rect
      x="102"
      y="96"
      width="46"
      height="40"
      rx="6"
      {...STROKE}
      strokeDasharray="5 5"
      className="mg-frame text-primary"
    />
    <g className="mg-phone-close">
      <Phone x={200} y={110} />
    </g>
  </svg>
);

const SCENES: Record<Overlay, () => React.ReactElement> = {
  face: Face,
  "hand-flat": HandFlat,
  thumb: Thumb,
  "hair-lengths": HairLengths,
  "hair-length": HairLength,
  "hair-crown": HairCrown,
  "hair-ends": HairEnds,
};

/** The looping illustration plus its steps, one highlighted at a time. */
export const MotionGuide = ({ overlay, steps }: { overlay: Overlay; steps: string[] }) => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % steps.length),
      2600,
    );
    return () => window.clearInterval(timer);
  }, [steps.length]);
  const Scene = SCENES[overlay];
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1.1fr_1fr]">
      <div className="mg-scene aspect-[24/17] w-full rounded-xl border border-border bg-secondary p-3">
        <Scene />
      </div>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step}
            className={`flex min-h-[44px] items-start gap-3 rounded-2xl px-3 py-2 text-sm transition-colors ${
              index === active ? "bg-secondary text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="readout mt-0.5 text-xs text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};
