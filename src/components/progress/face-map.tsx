import type { ZoneChange, ZoneKey } from "@/lib/progress";

const NAMES: Record<ZoneKey, string> = {
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  chin: "Chin",
};

// Zones on a 200 x 240 face, as the person sees themselves (their left cheek on the left).
const SHAPES: Record<ZoneKey, string> = {
  forehead: "M62 52 C80 34 120 34 138 52 L134 80 C112 72 88 72 66 80 Z",
  leftCheek: "M50 112 C58 100 76 104 82 118 C80 140 66 150 54 142 C46 134 46 122 50 112 Z",
  rightCheek:
    "M150 112 C142 100 124 104 118 118 C120 140 134 150 146 142 C154 134 154 122 150 112 Z",
  chin: "M80 186 C92 196 108 196 120 186 L116 206 C106 214 94 214 84 206 Z",
};

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

/**
 * Redness by face zone: each zone's fill deepens with redness (higher = more), and every zone also
 * shows its number and change in words, so colour is never the only signal.
 */
export const FaceMap = ({ zones }: { zones: ZoneChange[] }) => (
  <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
    <svg
      viewBox="0 0 200 240"
      className="art-draw mx-auto w-full max-w-[240px]"
      role="img"
      aria-label={`Redness by zone: ${zones.map((z) => `${NAMES[z.zone]} ${z.after.toFixed(1)}`).join(", ")}`}
    >
      <path
        d="M100 18 C150 18 172 60 170 112 C168 170 138 222 100 222 C62 222 32 170 30 112 C28 60 50 18 100 18 Z"
        pathLength={1}
        data-draw=""
        fill="none"
        className="stroke-foreground"
        strokeWidth="1.5"
      />
      <path
        d="M74 96 q10 -6 20 0 M106 96 q10 -6 20 0"
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="1.5"
      />
      <path
        d="M100 104 L96 140 q4 4 8 0"
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="1.5"
      />
      <path
        d="M84 166 q16 10 32 0"
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="1.5"
      />
      {zones.map((zone) => (
        <path
          key={zone.zone}
          d={SHAPES[zone.zone]}
          className="fill-primary stroke-primary transition-[fill-opacity] duration-700"
          fillOpacity={0.08 + (Math.min(100, Math.max(0, zone.after)) / 100) * 0.6}
          strokeWidth="1"
        >
          <title>{`${NAMES[zone.zone]}: ${zone.after.toFixed(1)}`}</title>
        </path>
      ))}
    </svg>
    <ul className="divide-y divide-border">
      {zones.map((zone) => (
        <li key={zone.zone} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
          <span className="text-sm font-semibold">{NAMES[zone.zone]}</span>
          <span className="flex items-baseline gap-3 text-sm">
            <span className="readout text-foreground">{zone.after.toFixed(1)}</span>
            {zone.delta !== null && (
              <span className="text-muted-foreground">
                <span className="readout">{signed(zone.delta)}</span>{" "}
                {Math.abs(zone.delta) < 2 ? "steady" : zone.delta < 0 ? "calmer" : "redder"}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
