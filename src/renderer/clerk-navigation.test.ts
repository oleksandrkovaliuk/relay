import { describe, expect, it } from "vitest";

import { createClerkRouterCallbacks, toRendererPath } from "./clerk-navigation";

describe("toRendererPath", () => {
  it("reduces the app's own absolute url to a path", () => {
    expect(toRendererPath("relay://renderer/")).toBe("/");
    expect(toRendererPath("relay://renderer/students/1?tab=a#top")).toBe("/students/1?tab=a#top");
  });

  it("passes a bare path through", () => {
    expect(toRendererPath("/")).toBe("/");
    expect(toRendererPath("/sign-in")).toBe("/sign-in");
  });

  it("refuses destinations outside this renderer", () => {
    // Relay gates on auth state, not the URL; an external target is nothing to navigate to.
    expect(toRendererPath("https://relay.democrat")).toBeNull();
    expect(toRendererPath("https://accounts.relay.democrat/sign-in/choose")).toBeNull();
    expect(toRendererPath("relay://other/")).toBeNull();
  });

  it("refuses unparseable or empty targets instead of throwing", () => {
    expect(toRendererPath("")).toBeNull();
    expect(toRendererPath("   ")).toBeNull();
    expect(toRendererPath("not a url")).toBeNull();
  });
});

describe("createClerkRouterCallbacks", () => {
  it("returns undefined so Clerk never awaits the router", () => {
    // The router promise does not settle once RouterProvider unmounts at sign-out, so
    // returning it left signOut() in flight forever.
    const { routerPush, routerReplace } = createClerkRouterCallbacks({
      navigate: () => new Promise(() => undefined),
    });

    expect(routerPush("relay://renderer/")).toBeUndefined();
    expect(routerReplace("relay://renderer/")).toBeUndefined();
  });

  it("navigates to the reduced path and honours replace", () => {
    const calls: Array<[string, { replace?: boolean }]> = [];
    const { routerPush, routerReplace } = createClerkRouterCallbacks({
      navigate: (path, options) => calls.push([path, options]),
    });

    routerPush("relay://renderer/students/1");
    routerReplace("/settings");

    expect(calls).toEqual([
      ["/students/1", { replace: undefined }],
      ["/settings", { replace: true }],
    ]);
  });

  it("does not navigate to a destination outside the renderer", () => {
    const calls: string[] = [];
    const { routerPush } = createClerkRouterCallbacks({
      navigate: (path) => calls.push(path),
    });

    routerPush("https://relay.democrat");
    expect(calls).toEqual([]);
  });

  it("swallows a rejected or throwing navigation, reporting it instead", async () => {
    const errors: string[] = [];
    const rejecting = createClerkRouterCallbacks({
      navigate: () => Promise.reject(new Error("no route")),
      onError: (path) => errors.push(`rejected:${path}`),
    });
    const throwing = createClerkRouterCallbacks({
      navigate: () => {
        throw new Error("router gone");
      },
      onError: (path) => errors.push(`threw:${path}`),
    });

    expect(rejecting.routerPush("/a")).toBeUndefined();
    expect(throwing.routerPush("/b")).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toEqual(["threw:/b", "rejected:/a"]);
  });
});
