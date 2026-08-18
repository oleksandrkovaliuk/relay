import { describe, expect, it } from "vitest";

import { withoutBrowserOriginForNativeClerkRequest } from "./clerk-native-request";

describe("withoutBrowserOriginForNativeClerkRequest", () => {
  it("removes Chromium's origin from authenticated native Clerk requests", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/client?_is_native=1",
        {
          Authorization: "Bearer client-jwt",
          Origin: "relay://renderer",
          Accept: "application/json",
        },
      ),
    ).toEqual({
      Authorization: "Bearer client-jwt",
      Accept: "application/json",
    });
  });

  it("handles Chromium's lowercase header names", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/oauth_callback?_is_native=1",
        {
          authorization: "Bearer client-jwt",
          origin: "relay://renderer",
        },
      ),
    ).toEqual({ authorization: "Bearer client-jwt" });
  });

  it("leaves browser and unauthenticated requests unchanged", () => {
    const browserHeaders = {
      Authorization: "Bearer session-token",
      Origin: "relay://renderer",
    };
    const unauthenticatedHeaders = { Origin: "relay://renderer" };

    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/client",
        browserHeaders,
      ),
    ).toBe(browserHeaders);
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/client?_is_native=1",
        unauthenticatedHeaders,
      ),
    ).toBe(unauthenticatedHeaders);
  });
});
