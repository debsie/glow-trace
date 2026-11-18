/**
 * Single place errors caught by error boundaries are reported. Today it only logs; wire an
 * error-tracking service in here later (and add it to the privacy policy's provider list).
 */
export const reportError = (error: unknown, context: Record<string, unknown> = {}): void => {
  if (typeof window === "undefined") return;
  console.error("[glowtrace]", { route: window.location.pathname, ...context }, error);
};
