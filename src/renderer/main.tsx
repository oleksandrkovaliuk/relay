import { RouterProvider } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "./router";

const rootElement = document.getElementById("app");
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();

if (!rootElement) throw new Error("Missing #app root element.");
if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL. Run `pnpm dev` to configure Convex.");

const convex = new ConvexReactClient(convexUrl);

createRoot(rootElement).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <TooltipProvider delay={350}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ConvexProvider>
  </StrictMode>,
);
