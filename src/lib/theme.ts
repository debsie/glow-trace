export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "glowtrace.theme";

/** Runs in <head> before first paint so the chosen theme never flashes the wrong one. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export const readTheme = (): Theme => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
};

/** What the screen is showing right now, resolving "system" through the OS setting. */
export const effectiveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;
