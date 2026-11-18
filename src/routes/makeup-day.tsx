import { createFileRoute, redirect } from "@tanstack/react-router";

/** Makeup Day lives in the Routine page; this keeps old links working. */
export const Route = createFileRoute("/makeup-day")({
  beforeLoad: () => {
    throw redirect({ to: "/routine", search: { tab: "makeup" } });
  },
});
