import { RouterProvider } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyTheme, readThemePreference } from "@/settings/theme";
import { router } from "./router";

applyTheme(readThemePreference());

const rootElement = document.getElementById("app");
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();

if (!rootElement) throw new Error("Missing #app root element.");
if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL. Run `pnpm dev` to configure Convex.");

const convex = new ConvexReactClient(convexUrl);
/**
 * Long enough to cover moving between pages, short enough not to hold sockets.
 * Every cached query stays subscribed and recomputes on the server whenever
 * anything it reads changes, so five minutes of that for a page nobody is
 * looking at was paid for in CPU on both ends.
 */
const CACHE_EXPIRATION_MILLISECONDS = 90 * 1_000;

createRoot(rootElement).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      {/*
        Leaving a page used to drop its subscriptions, so coming back re-fetched
        everything and flashed skeletons. The cache keeps them alive briefly after
        unmount: navigating away and back is then instant, and still live.
      */}
      <ConvexQueryCacheProvider expiration={CACHE_EXPIRATION_MILLISECONDS}>
        <TooltipProvider delay={350}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ConvexQueryCacheProvider>
    </ConvexProvider>
  </StrictMode>,
);
