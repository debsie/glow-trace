import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for a single client; content renders in pro.clients.$id.index.tsx and the lookbook route. */ import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/pro/clients/$id")({
  head: () =>
    pageHead({
      title: "Client — Glowtrace MUA Studio",
      description: "Client check-ins, skin prep, hair and nail notes and look status.",
      path: "/pro/clients",
      noindex: true,
    }),
  component: Outlet,
});
