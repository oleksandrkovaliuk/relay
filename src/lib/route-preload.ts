import type { QueryClient } from "@tanstack/react-query";

/**
 * Fills the cache for a route before it renders, without letting that block the app.
 *
 * A loader that awaits its data is what removes the skeleton flash — the page renders
 * with content already in hand. But an awaited loader also holds the navigation open, so
 * a failed query would leave the teacher on the previous page with no way forward. A
 * rejection is therefore swallowed here: the screen renders, its own loading and error
 * states take over, and the live subscription retries on its own.
 */
export function preload(
  queryClient: QueryClient,
  ...options: { queryKey: readonly unknown[] }[]
) {
  return Promise.all(
    options.map((option) =>
      queryClient
        .ensureQueryData(option as Parameters<QueryClient["ensureQueryData"]>[0])
        .catch(() => undefined),
    ),
  );
}
