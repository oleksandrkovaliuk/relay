import { describe, expect, it } from "vitest";

import { resolveClerkFrontendApiHost } from "./clerk-frontend-api";

function publishableKey(prefix: string, host: string) {
  return `${prefix}${Buffer.from(`${host}$`, "utf8").toString("base64")}`;
}

describe("resolveClerkFrontendApiHost", () => {
  it("reads the production Frontend API host out of a live key", () => {
    expect(resolveClerkFrontendApiHost(publishableKey("pk_live_", "clerk.relay.democrat"))).toBe(
      "clerk.relay.democrat",
    );
  });

  it("reads the development Frontend API host out of a test key", () => {
    expect(
      resolveClerkFrontendApiHost(publishableKey("pk_test_", "next-boa-5954.clerk.accounts.dev")),
    ).toBe("next-boa-5954.clerk.accounts.dev");
  });

  it("tolerates surrounding whitespace from an environment file", () => {
    const key = publishableKey("pk_live_", "clerk.relay.democrat");

    expect(resolveClerkFrontendApiHost(`  ${key}\n`)).toBe("clerk.relay.democrat");
  });

  it("returns null when the key is missing or empty", () => {
    expect(resolveClerkFrontendApiHost(undefined)).toBeNull();
    expect(resolveClerkFrontendApiHost("")).toBeNull();
    expect(resolveClerkFrontendApiHost("   ")).toBeNull();
  });

  it("returns null for a key that is not a Clerk publishable key", () => {
    expect(resolveClerkFrontendApiHost("sk_live_secret")).toBeNull();
    expect(resolveClerkFrontendApiHost("pk_live_")).toBeNull();
  });

  it("rejects a key whose payload is not a terminated host", () => {
    // Truncated keys still decode to host-shaped text, so the `$` terminator is what
    // separates a complete key from a corrupted one.
    const encode = (payload: string) =>
      `pk_live_${Buffer.from(payload, "utf8").toString("base64")}`;

    expect(resolveClerkFrontendApiHost(encode("clerk.relay.democrat"))).toBeNull();
    expect(resolveClerkFrontendApiHost(encode("not a host$"))).toBeNull();
    expect(resolveClerkFrontendApiHost(encode("localhost$"))).toBeNull();
  });
});
