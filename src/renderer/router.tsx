import { createMemoryHistory, createRouter } from "@tanstack/react-router";

import { RouteErrorPanel } from "@/app/route-error-panel";
import { readLastRoute } from "@/lib/last-route";
import { routeTree } from "./routeTree.gen";

/**
 * The packaged renderer is loaded from a `file:` URL, where there is no
 * meaningful address to push to. Memory history keeps navigation identical in
 * development and in the shipped app; `readLastRoute` restores the last page.
 */
export const router = createRouter({
  routeTree,
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
