import { convexQuery } from "@convex-dev/react-query";
import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

/**
 * A Convex query read through TanStack Query, with the shape the app already uses:
 * the value, or `undefined` until it arrives, and `"skip"` to stand a call down.
 *
 * Keeping that signature is deliberate. What changes underneath is where the data lives —
 * one cache the router can fill from a loader before a screen mounts, and that a mutation
 * can invalidate by key — rather than a subscription pool each component discovers for
 * itself on mount, which is what made every navigation start on a skeleton.
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: FunctionArgs<Query> | "skip",
): FunctionReturnType<Query> | undefined {
  const isSkipped = args === "skip";
  const resolvedArgs = (args ?? {}) as FunctionArgs<Query>;
  const { data } = useTanStackQuery({
    ...convexQuery(query, isSkipped ? ({} as FunctionArgs<Query>) : resolvedArgs),
    enabled: !isSkipped,
  });
  return isSkipped ? undefined : data;
}

/**
 * The same query as route-loader options, so `ensureQueryData` can fill the cache while
 * the navigation is still in flight.
 */
export function queryOptionsFor<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
) {
  return convexQuery(query, args);
}
