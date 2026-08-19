import { describe, expect, it } from "vitest";

import { toRendererPath } from "./clerk-navigation";

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
