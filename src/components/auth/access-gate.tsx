import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, LogOut } from "lucide-react";
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

const Waitlist = ({ email }: { email: string }) => {
  const { joinWaitlist, signOut } = useAuth();
  const [state, setState] = useState<"idle" | "joining" | "joined">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <Frame>
      <div className="surface space-y-4 p-6 text-center" aria-live="polite">
        <Clock className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
        <h1 className="font-display text-2xl font-semibold">You're early</h1>
        <p className="text-sm text-muted-foreground">
          Glowtrace is in private beta.{" "}
          <span className="font-semibold text-foreground">{email}</span> isn't on the invite list
          yet.
        </p>
        {state === "joined" ? (
          <p className="text-sm font-semibold text-success" role="status">
            You're on the waitlist. We'll email you when your spot opens.
          </p>
        ) : (
          <PrimaryButton
            className="w-full"
            disabled={state === "joining"}
            onClick={() => {
              setState("joining");
              setError(null);
              void joinWaitlist().then((result) => {
                if (result.ok) setState("joined");
                else {
                  setState("idle");
                  setError(result.reason);
                }
              });
            }}
          >
            {state === "joining" ? "Joining…" : "Join the Waitlist"}
          </PrimaryButton>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-[50px] items-center gap-2 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Use a different account
        </button>
      </div>
    </Frame>
  );
};

/** Shows the app to beta members, and sign-in or the waitlist to everyone else. */
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
  if (gate === "waitlist" && access.kind === "waitlisted") return <Waitlist email={access.email} />;
  return (
    <Frame>
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to Glowtrace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private beta. Invited testers only for now.
        </p>
      </div>
      <SignInForm next={pathname} />
    </Frame>
  );
};
