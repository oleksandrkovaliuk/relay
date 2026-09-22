import { createConvexQueryClient } from "@/lib/convex-query-client";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL. Run `pnpm dev` to configure Convex.");

/**
 * Created here rather than in the entry point so the router can hold the query client in
 * its context: a route loader fills the cache before its component ever renders, which is
 * what removes the skeleton-then-content flash on every navigation.
 */
export const { convexClient, convexQueryClient, queryClient } =
  createConvexQueryClient(convexUrl);
