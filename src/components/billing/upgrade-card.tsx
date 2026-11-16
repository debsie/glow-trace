import { Link } from "@tanstack/react-router";
import { ArrowRight, Gift, Lock } from "lucide-react";

import type { BlockedGate } from "@/lib/plans";
import { formatZar, PLANS } from "@/lib/plans";

/**
 * The friendly face of a plan limit: says what happened, what unlocks it, and offers the
 * free route (invite a friend) next to the paid one. Never shown as an error.
 */
export const UpgradeCard = ({
  gate,
  showInvite = false,
  onDismiss,
}: {
  gate: BlockedGate;
  /** Offer "invite a friend" as the no-cost way past a check-in limit. */
  showInvite?: boolean;
  onDismiss?: () => void;
}) => {
  const plan = gate.upgradeTo ? PLANS[gate.upgradeTo] : null;
  return (
    <div className="glass glow-border p-5" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="ai-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-foreground">{gate.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{gate.message}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {plan && (
          <Link
            to="/pricing"
            className="ai-gradient inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-transform hover:scale-[1.02]"
          >
            Get {plan.name} · {formatZar(plan.monthlyZar)}/month
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        {showInvite && (
          <Link
            to="/refer"
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-6 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary"
          >
            <Gift className="h-4 w-4" aria-hidden="true" />
            Invite a friend for bonus check-ins
          </Link>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[50px] items-center justify-center rounded-full px-5 text-base font-semibold text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
};
