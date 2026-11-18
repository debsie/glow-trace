import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/seo";

/** Public, indexable pages only — client screens under /pro are private and stay out. */
const PUBLIC_PATHS = [
  { path: "/", priority: "1.0" },
  { path: "/pricing", priority: "0.9" },
  { path: "/refer", priority: "0.7" },
  { path: "/affiliates", priority: "0.7" },
  { path: "/cookies", priority: "0.3" },
  { path: "/scan", priority: "0.6" },
  { path: "/routine", priority: "0.6" },
] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        // Prefer the configured public origin; fall back to whatever host served the request.
        const origin = SITE_URL || new URL(request.url).origin;
        const urls = PUBLIC_PATHS.map(
          (page) =>
            `  <url><loc>${origin}${page.path}</loc><changefreq>weekly</changefreq><priority>${page.priority}</priority></url>`,
        ).join("\n");
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
