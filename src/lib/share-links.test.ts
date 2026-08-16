import { describe, expect, it } from "vitest";

import { resolvePlayerOrigin } from "./share-links";

describe("resolvePlayerOrigin", () => {
  it("uses the configured deployment origin", () => {
    expect(
      resolvePlayerOrigin(" https://relay-production.convex.site/ ", false),
    ).toBe("https://relay-production.convex.site");
  });

  it("uses localhost only during development", () => {
    expect(resolvePlayerOrigin(undefined, true)).toBe("http://localhost:5180");
  });

  it("rejects a release without a configured player origin", () => {
    expect(() => resolvePlayerOrigin(undefined, false)).toThrow(
      "Missing VITE_PLAYER_ORIGIN",
    );
  });

  it("rejects unsupported URL protocols", () => {
    expect(() => resolvePlayerOrigin("file:///tmp/player", false)).toThrow(
      "must use http:// or https://",
    );
  });
});
