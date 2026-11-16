import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for the MUA portal; page content renders in pro.clients.index.tsx and pro.clients.$id.tsx. */
export const Route = createFileRoute("/pro/clients")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — MUA Client Roster" },
      {
        name: "description",
        content:
          "Your professional client roster: scans, skin prep, hair pairings and look approvals.",
      },
      { property: "og:title", content: "Glowtrace AI — MUA Client Roster" },
      {
        property: "og:description",
        content:
          "Your professional client roster: scans, skin prep, hair pairings and look approvals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Outlet,
});
