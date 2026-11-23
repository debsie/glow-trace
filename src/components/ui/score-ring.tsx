import type { CSSProperties } from "react";

/** A 0-100 score as a ring that sweeps to its value; the number is in the mono readout face. */
export const ScoreRing = ({
  value,
  label,
  className = "h-40 w-40",
}: {
  value: number | null;
  label: string;
  className?: string;
}) => {
  const radius = 52;
  const length = 2 * Math.PI * radius;
  const shown = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label={`${label}: ${value ?? "no score yet"}`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-secondary"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          className="ring-sweep stroke-primary"
          style={
            {
              "--ring-from": `${length}`,
              "--ring-to": `${length * (1 - shown / 100)}`,
            } as CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="readout text-4xl text-foreground">{value ?? "—"}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};
