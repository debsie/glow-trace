import { Component, type ReactNode } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Names the guarded flow in error reports, e.g. "glow_trace_canvas". */
  label?: string;
};

type ErrorBoundaryState = { hasError: boolean };

/** Wraps a major app flow so one broken section never blanks the whole page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    reportLovableError(error, { boundary: this.props.label ?? "error_boundary" });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold text-foreground">This part took a little break.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything else is still here for you.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 inline-flex min-h-[50px] items-center justify-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
