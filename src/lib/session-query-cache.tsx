import {
  ConvexQueryCacheContext,
  ConvexQueryCacheProvider,
} from "convex-helpers/react/cache/provider";
import { useConvex } from "convex/react";
import { clearQueryWarmups } from "./convex-query-warmup";
import { useContext, useLayoutEffect, type ReactNode } from "react";

import { clearQueryCache } from "./clear-query-cache";

const CACHE_RETENTION_MILLISECONDS = 10 * 60_000;
const MAXIMUM_IDLE_QUERIES = 100;

/**
 * How long a query survives after its last subscriber, everywhere: the teacher
 * workspace and the student player run the same numbers, so going back to a
 * page redraws it from cache instead of refetching it.
 */
export function QueryCache({ children }: { children: ReactNode }) {
  return (
    <ConvexQueryCacheProvider
      expiration={CACHE_RETENTION_MILLISECONDS}
      maxIdleEntries={MAXIMUM_IDLE_QUERIES}
    >
      {children}
    </ConvexQueryCacheProvider>
  );
}

/** The workspace's cache: the shared tuning, emptied when the session ends. */
export function SessionQueryCache({ children }: { children: ReactNode }) {
  return (
    <QueryCache>
      <SessionCacheLifetime>{children}</SessionCacheLifetime>
    </QueryCache>
  );
}

function SessionCacheLifetime({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { registry } = useContext(ConvexQueryCacheContext);

  useLayoutEffect(() => {
    if (!registry) return;
    // The helper retains subscriptions even after its provider unmounts.
    // Close them synchronously when this authenticated session ends.
    return () => {
      clearQueryWarmups(convex);
      clearQueryCache(registry);
    };
  }, [convex, registry]);

  return children;
}
