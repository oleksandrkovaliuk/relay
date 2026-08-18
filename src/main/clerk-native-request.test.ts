import { describe, expect, it } from "vitest";

import { withoutBrowserOriginForNativeClerkRequest } from "./clerk-native-request";

describe("withoutBrowserOriginForNativeClerkRequest", () => {
  it("removes Chromium's origin from native Clerk requests", () => {
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

  it("removes the origin before Clerk has issued a native client JWT", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/environment?_is_native=1",
        {
          Origin: "http://localhost:5173",
          Accept: "application/json",
        },
      ),
    ).toEqual({ Accept: "application/json" });
  });

  it("leaves browser requests unchanged", () => {
    const browserHeaders = {
      Authorization: "Bearer session-token",
      Origin: "relay://renderer",
    };

    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://clerk.relay.democrat/v1/client",
        browserHeaders,
      ),
    ).toBe(browserHeaders);
  });
});
