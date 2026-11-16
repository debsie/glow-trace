import type { ReactNode } from "react";
import { Check, Pencil, Send } from "lucide-react";

import { LOOK_STATUS_META } from "@/lib/beauty";
import type { LookStatus } from "@/lib/types";

/* Small shared presentation primitives, all token-based. */

export const Badge = ({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "primary" | "accent" | "success" | "warning" | "outline";
}) => {
  const tones: Record<string, string> = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/15 text-primary border border-primary/30",
    accent: "bg-accent/15 text-accent border border-accent/30",
    success: "bg-success/15 text-success border border-success/30",
    warning: "bg-warning/15 text-warning border border-warning/30",
    outline: "border border-border text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export const TierBadge = ({ tier }: { tier: string }) => {
  const tone =
    tier === "enterprise"
      ? "ai-gradient text-white"
      : tier === "pro"
        ? "bg-primary/15 text-primary border border-primary/30"
        : "border border-border text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase label-tracking ${tone}`}
    >
      {tier}
    </span>
  );
};

export const Gauge = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-display text-sm font-bold text-foreground">{value}</span>
    </div>
    <div
      className="mt-1 h-2.5 overflow-hidden rounded-full bg-secondary"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div
        className="ai-gradient h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
      />
    </div>
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
  <section className={`glass p-5 ${className}`}>
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && (
          <h2 className="label-tracking text-xs font-bold text-muted-foreground uppercase">
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
      <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
);

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
    className={`ai-gradient inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-6 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary ${className}`}
  >
    {children}
  </button>
);
