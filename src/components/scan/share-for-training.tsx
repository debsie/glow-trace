import { useEffect, useState } from "react";

import { shareTrainingPhoto, trainingStatus } from "@/lib/training-share";
import type { ScanReport } from "@/lib/types";

/** After a scan, for people who opted in: share this one photo, or not. Never automatic. */
export const ShareForTraining = ({ photo, report }: { photo: Blob; report: ScanReport }) => {
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    void trainingStatus().then((status) => setConsented(status?.consented ?? false));
  }, []);

  if (!consented || report.quality.filtered) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
      <p className="text-sm">
        {state === "sent"
          ? "Shared. Thank you for helping Glowtrace learn."
          : state === "failed"
            ? "That didn't send. Your photo stays on this phone."
            : "Help train Glowtrace with this photo? You can delete it any time from Privacy."}
      </p>
      {state !== "sent" && (
        <button
          type="button"
          disabled={state === "sending"}
          onClick={() => {
            setState("sending");
            void shareTrainingPhoto(photo, report).then((ok) => setState(ok ? "sent" : "failed"));
          }}
          className="inline-flex min-h-[50px] items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {state === "sending" ? "Sharing" : "Share this photo"}
        </button>
      )}
    </div>
  );
};
