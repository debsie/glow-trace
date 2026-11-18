import { useState } from "react";

import { PrimaryButton, SectionCard } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import { calibrationAvailable, submitContribution } from "@/integrations/calibration-api";
import {
  buildSample,
  FITZPATRICK,
  LIGHTING,
  questionFor,
  REPEAT_WINDOW_MS,
} from "@/lib/calibration";
import type { Lighting } from "@/lib/calibration";
import type { ScanReport } from "@/lib/types";

const LAST_KEY = "glowtrace.calibration.last";

type Last = { id: string; category: string; at: number };

const readLast = (): Last | null => {
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Last) : null;
  } catch {
    return null;
  }
};

const saveLast = (last: Last): void => {
  try {
    window.localStorage.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    // Not saved: repeat pairing just won't be offered next time.
  }
};

const FIELD =
  "mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base text-foreground";

/**
 * Asks, after a scored scan, whether to share the numbers (never the photo) to help check the
 * analysis. Opt-in every time, nothing pre-filled, and shown only to signed-in testers.
 */
export const CalibrationCard = ({ report }: { report: ScanReport }) => {
  const { access } = useAuth();
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [lighting, setLighting] = useState<Lighting | "">("");
  const [fitzpatrick, setFitzpatrick] = useState<number | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (access.kind !== "member" || !calibrationAvailable() || !report.quality.usable) return null;

  const last = readLast();
  const canRepeat =
    last !== null && last.category === report.category && Date.now() - last.at < REPEAT_WINDOW_MS;

  if (state === "done") {
    return (
      <SectionCard title="Thank you">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Your numbers were shared. No photo left your device. You can delete everything you have
          shared on the Your Data page.
        </p>
      </SectionCard>
    );
  }

  if (!open) {
    return (
      <SectionCard title="Help check the analysis">
        <p className="text-sm text-muted-foreground">
          Share this scan's scores and your own ratings to help us test Glowtrace on real people.
          Your photo stays on your device.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-[50px] items-center rounded-lg border border-border bg-secondary px-6 text-base font-semibold text-foreground"
        >
          Share these numbers
        </button>
      </SectionCard>
    );
  }

  const submit = async () => {
    if (lighting === "") {
      setError("Choose the light you used.");
      return;
    }
    const built = buildSample({
      report: {
        kernelVersion: report.kernelVersion,
        category: report.category,
        quality: report.quality,
        metrics: report.metrics,
      },
      selfReport: ratings,
      lighting,
      fitzpatrick,
      repeatOf: repeat && canRepeat ? last.id : null,
    });
    if (!built.ok) {
      setError(built.reason);
      return;
    }
    setError(null);
    setState("sending");
    const result = await submitContribution(built.sample);
    if (!result.ok) {
      setState("idle");
      setError(result.reason);
      return;
    }
    saveLast({ id: result.data, category: report.category, at: Date.now() });
    setState("done");
  };

  return (
    <SectionCard title="Help check the analysis">
      <p className="text-sm text-muted-foreground">
        We will receive only the scores shown above, your ratings below, the light you chose and
        whether the photo was sharp. Never the photo. Delete it all any time on the Your Data page.
      </p>

      <fieldset className="mt-4 space-y-4">
        <legend className="sr-only">Your ratings</legend>
        {report.metrics.map((metric) => (
          <div key={metric.key}>
            <p className="text-sm font-semibold">{questionFor(metric)}</p>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label={metric.label}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={ratings[metric.key] === value}
                  onClick={() => setRatings((current) => ({ ...current, [metric.key]: value }))}
                  className={`min-h-[50px] min-w-[50px] rounded-lg border text-base font-semibold ${
                    ratings[metric.key] === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <label className="mt-4 block text-sm font-semibold" htmlFor="cal-light">
        What light was the photo taken in?
      </label>
      <select
        id="cal-light"
        value={lighting}
        onChange={(event) => setLighting(event.target.value as Lighting | "")}
        className={FIELD}
      >
        <option value="">Choose</option>
        {LIGHTING.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-semibold" htmlFor="cal-skin">
        Skin type (optional, helps us check results hold for every skin tone)
      </label>
      <select
        id="cal-skin"
        value={fitzpatrick ?? ""}
        onChange={(event) =>
          setFitzpatrick(event.target.value === "" ? null : Number(event.target.value))
        }
        className={FIELD}
      >
        <option value="">Prefer not to say</option>
        {FITZPATRICK.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      {canRepeat && (
        <label className="mt-4 flex min-h-[50px] items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(event) => setRepeat(event.target.checked)}
            className="h-5 w-5"
          />
          This is a repeat of the photo I shared last time (same skin, different light or time).
        </label>
      )}

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-destructive" role="alert">
        {error}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <PrimaryButton disabled={state === "sending"} onClick={() => void submit()}>
          {state === "sending" ? "Sharing…" : "Share my numbers"}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[50px] items-center rounded-lg px-4 text-base font-semibold text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </SectionCard>
  );
};
