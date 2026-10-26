import { useCallback, useEffect, useState } from "react";

import { DEFAULT_PIN, PARENT_PIN_KEY, parsePin, verifyPin } from "@/lib/focus";

/** The 4-digit PIN that gates Parent Mode. Stored on this device only. */
export const useParentPin = () => {
  const [pin, setPin] = useState<string>(DEFAULT_PIN);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PARENT_PIN_KEY);
      if (raw !== null) setPin(parsePin(raw));
    } catch {
      // Fall back to the default PIN when storage is unavailable.
    }
    setHydrated(true);
  }, []);

  const changePin = useCallback((next: string) => {
    if (!verifyPin(next, next)) return; // must be 4 digits
    setPin(next);
    try {
      window.localStorage.setItem(PARENT_PIN_KEY, next);
    } catch {
      // Session-only PIN if storage is unavailable.
    }
  }, []);

  const verify = useCallback((entry: string) => verifyPin(entry, pin), [pin]);

  return { pin, hydrated, changePin, verify };
};
