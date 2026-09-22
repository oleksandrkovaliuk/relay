import { createMemoryHistory, createRouter } from "@tanstack/react-router";

import { RouteErrorPanel } from "@/app/route-error-panel";
import { queryClient } from "./clients";
import { readLastRoute } from "@/lib/last-route";
import { routeTree } from "./routeTree.gen";

/**
 * The packaged renderer uses a local protocol only as a secure Clerk origin.
 * Memory history keeps navigation identical in development and in the shipped
 * app; `readLastRoute` restores the last page.
 */
export const router = createRouter({
  routeTree,
  // Loaders read the query client from here, so a route can fill the cache before its
  // component mounts.
  context: { queryClient },
  // A preload on hover should fill the cache and be trusted once there: these are live
  // Convex subscriptions, so "stale" is not a state they reach.
  defaultPreloadStaleTime: Number.POSITIVE_INFINITY,
  history: createMemoryHistory({ initialEntries: [readLastRoute()] }),
  defaultPreload: "intent",
  defaultErrorComponent: ({ error, reset }) => (
    <RouteErrorPanel error={error} reset={reset} />
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
