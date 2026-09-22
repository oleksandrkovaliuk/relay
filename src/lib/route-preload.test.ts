import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { preload } from "./route-preload";

const options = (key: string, queryFn: () => Promise<unknown>) => ({
  queryKey: [key] as const,
  queryFn,
});

describe("route preload", () => {
  it("fills the cache before the route renders", async () => {
    const queryClient = new QueryClient();
    await preload(queryClient, options("students", async () => ["ada"]));
    expect(queryClient.getQueryData(["students"])).toEqual(["ada"]);
  });

  it("waits for every query it was given", async () => {
    const queryClient = new QueryClient();
    await preload(
      queryClient,
      options("a", async () => 1),
      options("b", async () => 2),
    );
    expect([queryClient.getQueryData(["a"]), queryClient.getQueryData(["b"])]).toEqual([1, 2]);
  });

  /** Otherwise a failed query holds the navigation open and the teacher cannot leave. */
  it("resolves even when a query fails, so navigation still completes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await expect(
      preload(
        queryClient,
        options("broken", async () => {
          throw new Error("Convex is unreachable");
        }),
        options("fine", async () => "ok"),
      ),
    ).resolves.toBeDefined();
    expect(queryClient.getQueryData(["fine"])).toBe("ok");
  });
});
