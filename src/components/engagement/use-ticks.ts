import { useCallback, useEffect, useState } from "react";

import { loadTicks, TICKS_KEY, toggleTick } from "@/lib/daily";
import type { Ticks } from "@/lib/daily";

/** Routine tick-offs on this device (localStorage, validated on load). */
export const useTicks = () => {
  const [ticks, setTicks] = useState<Ticks>({});
  useEffect(() => {
    try {
      setTicks(loadTicks(window.localStorage.getItem(TICKS_KEY)));
    } catch {
      setTicks({});
    }
  }, []);
  const toggle = useCallback((day: string, mode: string, step: number) => {
    setTicks((current) => {
      const next = toggleTick(current, day, mode, step);
      try {
        window.localStorage.setItem(TICKS_KEY, JSON.stringify(next));
      } catch {
        // Kept for this visit only.
      }
      return next;
    });
  }, []);
  return { ticks, toggle };
};
