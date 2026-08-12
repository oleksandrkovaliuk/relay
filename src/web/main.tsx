import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RelayLogo } from "@/components/relay-logo";
import { HomeworkPlayer } from "@/homework/player/homework-player";
import "@/styles.css";
import { readShareToken } from "./read-share-token";

const rootElement = document.getElementById("app");
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();

if (!rootElement) throw new Error("Missing #app root element.");
if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL at build time.");

const convex = new ConvexReactClient(convexUrl);
const shareToken = readShareToken(window.location);

createRoot(rootElement).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ConvexQueryCacheProvider>
        <TooltipProvider delay={350}>
        {shareToken ? <HomeworkPlayer shareToken={shareToken} /> : <MissingLink />}
        </TooltipProvider>
      </ConvexQueryCacheProvider>
    </ConvexProvider>
  </StrictMode>,
);

function MissingLink() {
  return (
    <div className="min-h-screen bg-plane">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <RelayLogo markSize={22} className="mb-8" />
        <div className="rounded-card border border-line bg-surface p-8">
          <h1 className="text-[17px] font-semibold">No homework link found.</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
            Open the full link your teacher sent you. It should end with a homework code.
          </p>
        </div>
      </div>
    </div>
  );
}
