import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppStateProvider } from "@/context/app-state";
import { SiteShell } from "@/components/layout/site-nav";
import { organizationSchema, pageHead, SITE, websiteSchema } from "@/lib/seo";

// Site-wide defaults; each route's own head() overrides the title, description and canonical.
const rootHead = pageHead({
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  path: "/",
  schema: [organizationSchema(), websiteSchema()],
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-primary font-display text-7xl font-semibold">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="bg-primary inline-flex min-h-[50px] items-center justify-center rounded-lg px-6 text-base font-semibold text-primary-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-primary inline-flex min-h-[50px] items-center justify-center rounded-lg px-6 text-base font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex min-h-[50px] items-center justify-center rounded-lg border border-border bg-card px-6 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Mirror the --background tokens in styles.css (a meta tag can't read CSS variables).
      {
        name: "theme-color",
        content: "oklch(0.972 0.004 10)",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "oklch(0.17 0.012 340)",
        media: "(prefers-color-scheme: dark)",
      },
      { name: "color-scheme", content: "light dark" },
      { name: "application-name", content: SITE.name },
      { name: "apple-mobile-web-app-title", content: SITE.name },
      { name: "geo.region", content: "ZA" },
      { name: "geo.placename", content: "South Africa" },
      ...rootHead.meta,
    ],
    scripts: rootHead.scripts,
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      ...rootHead.links,
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang={SITE.language}>
      <head>
        <HeadContent />
        <noscript>
          <style>{".reveal{opacity:1;transform:none}"}</style>
        </noscript>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <SiteShell>
          <Outlet />
        </SiteShell>
        <Toaster position="top-center" theme="system" />
      </AppStateProvider>
    </QueryClientProvider>
  );
}
