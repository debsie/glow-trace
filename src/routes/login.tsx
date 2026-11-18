import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

import { SignInForm } from "@/components/auth/sign-in-form";
import { BUTTON_PRIMARY, LogoMark } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import { safeNext } from "@/lib/access";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({ next: z.string().max(200).optional() });

export const Route = createFileRoute("/login")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Sign In — Glowtrace",
      description: "Sign in to the Glowtrace private beta with an email link or Google.",
      path: "/login",
      noindex: true,
    }),
  component: LoginPage,
});

function LoginPage() {
  const { access } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const destination = safeNext(next);

  // Coming back from an email link or Google: once the session is read, carry on.
  useEffect(() => {
    if (access.kind === "member" || access.kind === "waitlisted") {
      void navigate({ to: destination });
    }
  }, [access.kind, destination, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="page-enter w-full max-w-md space-y-6">
        <Link to="/" className="flex min-h-[50px] items-center justify-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-2xl font-semibold">Glowtrace</span>
        </Link>
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private beta. Invited testers only for now.
          </p>
        </div>
        {access.kind === "demo" ? (
          <div className="surface space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sign-in switches on once Lovable Cloud is connected. Until then the app runs as a demo
              on this device.
            </p>
            <Link to="/app" className={`${BUTTON_PRIMARY} w-full`}>
              Open the demo <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        ) : access.kind === "checking" ? (
          <p className="text-center text-sm text-muted-foreground" role="status">
            Signing you in…
          </p>
        ) : (
          <SignInForm next={destination} />
        )}
      </div>
    </div>
  );
}
