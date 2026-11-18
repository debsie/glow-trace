import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, LogOut, TimerOff } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { LogoMark, PrimaryButton } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import { gateFor } from "@/lib/access";

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="page-enter mx-auto max-w-md space-y-6 py-6">
    <Link to="/" className="flex min-h-[50px] items-center justify-center gap-2">
      <LogoMark className="h-7 w-7" />
      <span className="font-display text-2xl font-semibold">Glowtrace</span>
    </Link>
    {children}
  </div>
);

const field =
  "mt-1 min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground";

/** Ask for beta access, or for more time once it has ended. */
const RequestAccess = ({ email, expired }: { email: string; expired: boolean }) => {
  const { requestAccess, signOut } = useAuth();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const Icon = expired ? TimerOff : Clock;

  return (
    <Frame>
      <div className="surface space-y-4 p-6" aria-live="polite">
        <div className="text-center">
          <Icon className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
          <h1 className="mt-3 font-display text-2xl font-semibold">
            {expired ? "Your beta access has ended" : "Request beta access"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {expired ? (
              <>
                Thanks for testing Glowtrace. Ask for more time and we'll extend{" "}
                <span className="font-semibold text-foreground">{email}</span>. Your scans are still
                saved on this device.
              </>
            ) : (
              <>
                Glowtrace is in private beta.{" "}
                <span className="font-semibold text-foreground">{email}</span> isn't on the invite
                list yet. Tell us a little about yourself and we'll be in touch.
              </>
            )}
          </p>
        </div>

        {state === "sent" ? (
          <p
            className="rounded-2xl border border-success px-4 py-3 text-center text-sm text-foreground"
            role="status"
          >
            <span className="font-semibold text-success">Request sent. </span>
            We'll email you as soon as your access is ready.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setState("sending");
              setError(null);
              void requestAccess(name, note).then((result) => {
                if (result.ok) setState("sent");
                else {
                  setState("idle");
                  setError(result.reason);
                }
              });
            }}
          >
            <label className="block text-sm font-semibold text-muted-foreground">
              Your name
              <input
                required
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm font-semibold text-muted-foreground">
              {expired
                ? "What would you like more time for? (optional)"
                : "What brings you to Glowtrace? (optional)"}
              <textarea
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. I'm a bridal makeup artist, or I'm dealing with redness"
                className={`${field} min-h-[96px] py-3`}
              />
            </label>
            <PrimaryButton type="submit" className="w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : expired ? "Ask for More Time" : "Request Access"}
            </PrimaryButton>
          </form>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="text-center">
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[50px] items-center gap-2 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Use a different account
          </button>
        </div>
      </div>
    </Frame>
  );
};

/** Shows the app to beta members, and sign-in, a request form or an expiry notice otherwise. */
export const AccessGate = ({ children }: { children: ReactNode }) => {
  const { access } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const gate = gateFor(pathname, access);

  if (gate === "show") return <>{children}</>;
  if (gate === "wait") {
    return (
      <p
        className="py-24 text-center text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Checking your access…
      </p>
    );
  }
  if (access.kind === "waitlisted") return <RequestAccess email={access.email} expired={false} />;
  if (access.kind === "expired") return <RequestAccess email={access.email} expired />;
  return (
    <Frame>
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to Glowtrace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private beta. Sign in, then request access.
        </p>
      </div>
      <SignInForm next={pathname} />
    </Frame>
  );
};
