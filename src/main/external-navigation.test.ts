import { describe, expect, it } from "vitest";

import { createExternalNavigationGuard } from "./external-navigation";

describe("createExternalNavigationGuard", () => {
  it("opens a url the first time it is requested", () => {
    const guard = createExternalNavigationGuard({ now: () => 0 });

    expect(guard.shouldOpen("https://accounts.relay.democrat/sign-up")).toBe(true);
  });

  it("drops an immediate repeat, which is what a redirect loop looks like", () => {
    let clock = 0;
    const guard = createExternalNavigationGuard({ now: () => clock, repeatWindowMs: 2000 });

    expect(guard.shouldOpen("https://relay.democrat")).toBe(true);
    clock = 5;
    expect(guard.shouldOpen("https://relay.democrat")).toBe(false);
    clock = 1999;
    expect(guard.shouldOpen("https://relay.democrat")).toBe(false);
  });

  it("opens the same url again once the window has elapsed, so a real click still works", () => {
    let clock = 0;
    const guard = createExternalNavigationGuard({ now: () => clock, repeatWindowMs: 2000 });

    expect(guard.shouldOpen("https://relay.democrat")).toBe(true);
    clock = 2000;
    expect(guard.shouldOpen("https://relay.democrat")).toBe(true);
  });

  it("never blocks a different url", () => {
    const guard = createExternalNavigationGuard({ now: () => 0, repeatWindowMs: 2000 });

    expect(guard.shouldOpen("https://accounts.relay.democrat/sign-up")).toBe(true);
    expect(guard.shouldOpen("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
    expect(guard.shouldOpen("https://accounts.relay.democrat/sign-up")).toBe(true);
  });
});
