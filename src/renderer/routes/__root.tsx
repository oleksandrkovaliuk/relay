import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { WorkspaceLayout } from "@/app/workspace-layout";

/** Loaders reach the cache through this, so a route can fill it before rendering. */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: WorkspaceLayout,
});
