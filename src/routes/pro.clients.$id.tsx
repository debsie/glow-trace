import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for a single client; content renders in pro.clients.$id.index.tsx and the lookbook route. */
export const Route = createFileRoute("/pro/clients/$id")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — Client Dashboard" },
      {
        name: "description",
        content: "Client scans, assigned skin prep, hair and wig pairings, nail art concepts and look status.",
      },
      { property: "og:title", content: "Glowtrace AI — Client Dashboard" },
      {
        property: "og:description",
        content: "Client scans, assigned skin prep, hair and wig pairings, nail art concepts and look status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Outlet,
});
