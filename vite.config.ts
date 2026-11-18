// Glowtrace build configuration. Plain Vite + TanStack Start, no hosting-platform wrapper.
// The server is built by Nitro for Vercel; set NITRO_PRESET to build for another host
// (for example `NITRO_PRESET=node-server bun run build` for a local production server).
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

import { securityHeaders } from "./src/lib/security-headers";

export default defineConfig(({ command, mode }) => {
  // VITE_* values from .env files and the environment (Vercel sets these at build time).
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect TanStack Start's server entry to src/server.ts (our SSR error wrapper).
        server: { entry: "server" },
        // Never let server-only code end up in the browser bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build"
        ? [
            nitro({
              preset: process.env["NITRO_PRESET"] ?? "vercel",
              // Security headers on every response, page or file.
              routeRules: { "/**": { headers: securityHeaders(env["VITE_SUPABASE_URL"]) } },
            }),
          ]
        : []),
      viteReact(),
    ],
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    build: {
      // Serve fonts as files, never inlined as data: URIs, so the content security policy
      // can stay at font-src 'self'.
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
    server: { host: "::", port: 8080 },
  };
});
