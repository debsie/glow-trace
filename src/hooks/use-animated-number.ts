import { useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "./use-in-view";

/** Tweens towards `target` whenever it changes. The first render shows the target as-is. */
export const useAnimatedNumber = (target: number, durationMs = 700): number => {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    if (prefersReducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const value = start + (target - start) * eased;
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return shown;
};
