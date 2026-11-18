import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { applyTheme, effectiveTheme, readTheme } from "@/lib/theme";

/** Flips between light and dark. Starts from the OS setting until the person chooses. */
export const ThemeToggle = () => {
  // Unknown until mounted so server and first client render match.
  const [current, setCurrent] = useState<"light" | "dark" | null>(null);
  useEffect(() => setCurrent(effectiveTheme(readTheme())), []);

  const next = current === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        applyTheme(next);
        setCurrent(next);
      }}
      className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      {current === "dark" ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
};
