import type { ReactNode } from "react";
import { Check, Lock, Pencil, Send } from "lucide-react";

import { LOOK_STATUS_META } from "@/lib/beauty";
import { PLANS } from "@/lib/plans";
import type { LookStatus, SubscriptionTier } from "@/lib/types";

/* Small shared presentation primitives, all token-based. */

export const Badge = ({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "primary" | "accent" | "success" | "warning" | "outline";
}) => {
  // Tone colours the border and the word; the fill stays quiet. A word is always present.
  const tones: Record<string, string> = {
    default: "border-border text-foreground",
    primary: "border-primary text-primary",
    accent: "border-accent text-accent",
    success: "border-success text-success",
    warning: "border-warning text-warning",
    outline: "border-border text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export const TierBadge = ({ tier }: { tier: SubscriptionTier }) => (
  <span
    className={`label-tracking inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase ${
      tier === "free"
        ? "border border-border bg-secondary text-muted-foreground"
        : "bg-primary text-primary-foreground"
    }`}
  >
    {PLANS[tier].name}
  </span>
);

/** Small "PRO" lock marker for features above the current plan. Word + icon, never colour alone. */
export const ProBadge = ({ label = "PRO" }: { label?: string }) => (
  <span className="label-tracking inline-flex items-center gap-1 rounded-full border border-primary bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-primary uppercase">
    <Lock className="h-3 w-3" aria-hidden="true" />
    {label}
  </span>
);

/** The Glowtrace mark: a thin ring with a single trace line through it. */
export const LogoMark = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`text-primary ${className}`}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M6.5 13.5c1.6-3.6 3.6-3.6 5.5 0s3.9 3.6 5.5 0" />
  </svg>
);

/** One biomarker from 0 to 100: name, mono readout, flat track, and a caption giving direction. */
export const Gauge = ({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption?: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="readout text-sm text-foreground">{value.toFixed(1)}</span>
    </div>
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none"
        style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
      />
    </div>
    {caption && <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{caption}</p>}
  </div>
);

export const SectionCard = ({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`surface p-5 ${className}`}>
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && (
          <h2 className="label-tracking font-sans text-xs font-bold text-muted-foreground uppercase">
            {title}
          </h2>
        )}
        {action}
      </div>
    )}
    {children}
  </section>
);

export const PageHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="font-display text-3xl leading-9 font-semibold text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/** Shared button shapes, for links that must look like buttons. */
export const BUTTON_PRIMARY =
  "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const BUTTON_GHOST =
  "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-6 text-base font-semibold text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const StatusBadge = ({ status }: { status: LookStatus }) => {
  const meta = LOOK_STATUS_META[status];
  const icon =
    meta.icon === "check" ? (
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
    ) : meta.icon === "send" ? (
      <Send className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    );
  return (
    <Badge tone={meta.tone === "muted" ? "outline" : meta.tone}>
      {icon}
      {meta.label}
    </Badge>
  );
};

export const PrimaryButton = ({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${BUTTON_PRIMARY} ${className}`}
  >
    {children}
  </button>
);

export const GhostButton = ({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <button type="button" onClick={onClick} className={`${BUTTON_GHOST} ${className}`}>
    {children}
  </button>
);
