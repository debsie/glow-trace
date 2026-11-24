import { useId, useState } from "react";

/**
 * Before and after, one photo over the other: drag the handle (or use the arrow keys on the
 * slider) to wipe between them. Both photos stay on this device.
 */
export const BeforeAfter = ({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) => {
  const [split, setSplit] = useState(50);
  const id = useId();
  return (
    <figure className="space-y-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-secondary select-none sm:aspect-[4/3]">
        <img
          src={after}
          alt={`After, ${afterLabel}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <img
          src={before}
          alt={`Before, ${beforeLabel}`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-camera-guide"
          style={{ left: `${split}%` }}
          aria-hidden="true"
        >
          <span className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-camera-guide bg-foreground/40 text-camera-guide">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
        <span className="absolute top-3 left-3 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold">
          Before
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold">
          After
        </span>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(event) => setSplit(Number(event.target.value))}
          aria-label="Wipe between the before and after photos"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>Before · {beforeLabel}</span>
        <span className="text-right">After · {afterLabel}</span>
      </figcaption>
    </figure>
  );
};
