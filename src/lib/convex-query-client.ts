import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";

/**
 * One Convex subscription layer behind TanStack Query.
 *
 * Convex queries are live subscriptions, so the cache does not need staleness heuristics:
 * a subscribed query is never stale, and a query nobody is watching is dropped after its
 * garbage-collection window rather than refetched. `staleTime: Infinity` says exactly
 * that, and stops TanStack refetching on focus or reconnect behind a socket that already
 * pushes its own updates.
 */
let sharedQueryClient: QueryClient | null = null;

/**
 * The cache the prefetch helpers write into. They are called from event handlers rather
 * than from render, so they cannot read it from context.
 */
export function getSharedQueryClient() {
  if (!sharedQueryClient) throw new Error("The Convex query client has not been created.");
  return sharedQueryClient;
}

export function createConvexQueryClient(convexUrl: string) {
  const convexClient = new ConvexReactClient(convexUrl);
  const convexQueryClient = new ConvexQueryClient(convexClient);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: CACHE_RETENTION_MILLISECONDS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
      },
    },
  });

  convexQueryClient.connect(queryClient);
  sharedQueryClient = queryClient;
  return { convexClient, convexQueryClient, queryClient };
}

/**
 * How long a query's data outlives its last subscriber. Long enough that going back to a
 * page it was read on redraws from cache rather than a skeleton.
 */
const CACHE_RETENTION_MILLISECONDS = 10 * 60_000;
