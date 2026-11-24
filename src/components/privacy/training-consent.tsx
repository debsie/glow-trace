import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GhostButton, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { giveTrainingConsent, trainingStatus, withdrawTrainingConsent } from "@/lib/training-share";
import type { TrainingStatus } from "@/lib/training-share";

/**
 * "Help train Glowtrace": optional, unticked, separate from beta access. Explains exactly what is
 * shared, who sees it, how long it is kept and how to take it back.
 */
export const TrainingConsent = () => {
  const [status, setStatus] = useState<TrainingStatus>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    void trainingStatus().then(setStatus);
  }, []);

  if (!status) return null;

  return (
    <SectionCard title="Help train Glowtrace (optional)">
      <div className="space-y-3 text-sm">
        <p>
          Glowtrace learns best from real photos taken the way you take them. If you'd like to help,
          you can choose to share some of your scan photos with us. You never have to: the beta and
          every feature work the same either way.
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>You choose photo by photo, after each scan. Nothing is shared automatically.</li>
          <li>
            We keep the photo (as a new JPEG with no location or camera details) and that scan's
            readings, to train and test Glowtrace's models. Nothing else.
          </li>
          <li>
            Stored privately with Supabase. Only the Glowtrace team can see them; they are never
            sold, published or shared.
          </li>
          <li>Kept for 2 years at most, then deleted.</li>
          <li>Change your mind any time: withdrawing deletes every photo you shared.</li>
          <li>Adults only (18+). Don't share photos of anyone else.</li>
        </ul>
        {status.consented ? (
          <>
            <p className="font-semibold" aria-live="polite">
              You're helping. {status.shared} {status.shared === 1 ? "photo" : "photos"} shared so
              far. Thank you.
            </p>
            <Link
              to="/lighting-challenge"
              className="inline-flex min-h-[50px] items-center font-semibold text-primary hover:underline"
            >
              Take the lighting challenge: three selfies, three lights
            </Link>
            <GhostButton
              onClick={() => {
                if (busy) return;
                setBusy(true);
                void withdrawTrainingConsent().then(async (ok) => {
                  setNote(
                    ok
                      ? "Withdrawn. Every photo you shared has been deleted."
                      : "That didn't go through. Try again, or email us and we'll delete them.",
                  );
                  setStatus(await trainingStatus());
                  setBusy(false);
                });
              }}
            >
              Stop sharing and delete my photos
            </GhostButton>
          </>
        ) : (
          <>
            <label className="flex min-h-[50px] cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
              <span>
                I'm 18 or older, and I agree that photos I choose to share can be used to train and
                test Glowtrace, as described above.
              </span>
            </label>
            <PrimaryButton
              disabled={!agreed || busy}
              onClick={() => {
                setBusy(true);
                void giveTrainingConsent().then(async (ok) => {
                  setNote(ok ? "" : "That didn't go through. Try again.");
                  setStatus(await trainingStatus());
                  setBusy(false);
                });
              }}
            >
              Turn on photo sharing
            </PrimaryButton>
          </>
        )}
        {note && (
          <p className="text-sm" role="status">
            {note}
          </p>
        )}
      </div>
    </SectionCard>
  );
};
