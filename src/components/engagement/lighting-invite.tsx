import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import { useAuth } from "@/context/auth";

/** A slim invite on Home for signed-in members who haven't done the lighting challenge yet. */
export const LightingInvite = () => {
  const { access } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(
        access.kind === "member" && !window.localStorage.getItem("glowtrace:lighting-challenge:v1"),
      );
    } catch {
      setShow(false);
    }
  }, [access.kind]);
  if (!show) return null;
  return (
    <Link
      to="/lighting-challenge"
      className="surface lift flex items-center justify-between gap-4 p-5"
    >
      <span className="flex items-center gap-4">
        <LineArt motif="sun" className="art-draw h-12 w-12 shrink-0" />
        <span>
          <span className="block font-display text-lg font-semibold">
            Help Glowtrace see in any light
          </span>
          <span className="block text-sm text-muted-foreground">
            Three selfies in three lights, two minutes, shared only if you choose.
          </span>
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    </Link>
  );
};
