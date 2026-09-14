import { createElement, useContext, type ContextType } from "react";
import { renderToString } from "react-dom/server";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { ConvexQueryCacheContext, ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import { clearQueryCache } from "./clear-query-cache";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("reuses retained subscriptions, isolates students, and releases everything at sign-out", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  const unsubscribe = vi.fn();
  const watchQuery = vi.fn(() => ({ onUpdate: () => unsubscribe }));
  const client = { watchQuery } as unknown as ConvexReactClient;
  let context: ContextType<typeof ConvexQueryCacheContext> | undefined;
  function CaptureCache() {
    context = useContext(ConvexQueryCacheContext);
    return null;
  }
  renderToString(createElement(ConvexProvider, { client },
    createElement(ConvexQueryCacheProvider, { expiration: 600_000, maxIdleEntries: 100 },
      createElement(CaptureCache))));
  const registry = context!.registry!;

  registry.start("first-visit", "student-a", api.students.list, {});
  registry.end("first-visit");
  vi.advanceTimersByTime(60_000);
  expect(unsubscribe).not.toHaveBeenCalled();
  registry.start("return-visit", "student-a", api.students.list, {});
  expect(watchQuery).toHaveBeenCalledTimes(1);

  registry.start("other-student", "student-b", api.students.list, {});
  expect(watchQuery).toHaveBeenCalledTimes(2);
  registry.end("other-student");
  clearQueryCache(registry);
  expect(unsubscribe).toHaveBeenCalledTimes(2);
  expect(registry.queries.size).toBe(0);
  expect(registry.subs.size).toBe(0);
  expect(registry.idle).toBe(0);
  vi.runAllTimers();
  expect(unsubscribe).toHaveBeenCalledTimes(2);

  // React Strict Mode may set effects up again after the cleanup.
  registry.start("remount", "student-a", api.students.list, {});
  registry.end("remount");
  vi.advanceTimersByTime(600_000);
  expect(unsubscribe).toHaveBeenCalledTimes(3);
});
