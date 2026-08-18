import { describe, expect, it } from "vitest";

import {
  withRendererCorsForNativeClerkResponse,
  withoutBrowserOriginForNativeClerkRequest,
} from "./clerk-native-request";

const FRONTEND_API_HOST = "clerk.relay.democrat";
const NATIVE_CLERK_URL = `https://${FRONTEND_API_HOST}/v1/client?_is_native=1`;
const RENDERER_ORIGIN = "relay://renderer";

describe("withoutBrowserOriginForNativeClerkRequest", () => {
  it("removes Chromium's origin from an authenticated native request", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        NATIVE_CLERK_URL,
        {
          Authorization: "Bearer client-jwt",
          Origin: "relay://renderer",
          Accept: "application/json",
        },
        FRONTEND_API_HOST,
      ),
    ).toEqual({
      Authorization: "Bearer client-jwt",
      Accept: "application/json",
    });
  });

  it("matches both headers case-insensitively, as Chromium may send either casing", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        NATIVE_CLERK_URL,
        { authorization: "Bearer client-jwt", origin: "relay://renderer" },
        FRONTEND_API_HOST,
      ),
    ).toEqual({ authorization: "Bearer client-jwt" });
  });

  it("removes the origin before Clerk has issued a bearer token", () => {
    // A production instance rejects an unauthenticated request too, because its key is
    // bound to relay.democrat and the renderer's origin is not a subdomain of it.
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        NATIVE_CLERK_URL,
        { Origin: RENDERER_ORIGIN, Accept: "application/json" },
        FRONTEND_API_HOST,
      ),
    ).toEqual({ Accept: "application/json" });
  });

  it("removes the origin from a CORS preflight, which Clerk answers without one", () => {
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        NATIVE_CLERK_URL,
        {
          Origin: RENDERER_ORIGIN,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization",
        },
        FRONTEND_API_HOST,
      ),
    ).toEqual({
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization",
    });
  });

  it("leaves the headers untouched when there is no origin to remove", () => {
    const headers = { Authorization: "Bearer client-jwt" };

    expect(
      withoutBrowserOriginForNativeClerkRequest(NATIVE_CLERK_URL, headers, FRONTEND_API_HOST),
    ).toBe(headers);
  });

  it("does not alter non-native, non-Clerk, or insecure requests", () => {
    const headers = { Authorization: "Bearer client-jwt", Origin: RENDERER_ORIGIN };

    expect(
      withoutBrowserOriginForNativeClerkRequest(
        `https://${FRONTEND_API_HOST}/v1/client`,
        headers,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://example.com/v1/client?_is_native=1",
        headers,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
    expect(
      withoutBrowserOriginForNativeClerkRequest(
        `http://${FRONTEND_API_HOST}/v1/client?_is_native=1`,
        headers,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
  });

  it("leaves another Clerk instance's traffic alone", () => {
    const headers = { Authorization: "Bearer client-jwt", Origin: RENDERER_ORIGIN };

    expect(
      withoutBrowserOriginForNativeClerkRequest(
        "https://next-boa-5954.clerk.accounts.dev/v1/client?_is_native=1",
        headers,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
  });

  it("passes an unparseable url through instead of throwing inside the callback", () => {
    const headers = { Authorization: "Bearer client-jwt", Origin: RENDERER_ORIGIN };

    expect(withoutBrowserOriginForNativeClerkRequest("not a url", headers, FRONTEND_API_HOST)).toBe(
      headers,
    );
  });
});

describe("withRendererCorsForNativeClerkResponse", () => {
  it("exposes the Authorization header the Electron SDK reads the client JWT from", () => {
    const headers = withRendererCorsForNativeClerkResponse(
      NATIVE_CLERK_URL,
      { "Content-Type": ["application/json"] },
      RENDERER_ORIGIN,
      FRONTEND_API_HOST,
    );

    expect(headers).toEqual({
      "Content-Type": ["application/json"],
      "Access-Control-Allow-Origin": [RENDERER_ORIGIN],
      "Access-Control-Allow-Headers": ["Authorization, *"],
      "Access-Control-Allow-Methods": ["GET, POST, PATCH, PUT, DELETE, OPTIONS"],
      "Access-Control-Expose-Headers": ["Authorization, Clerk-Db-Jwt, *"],
      "Access-Control-Max-Age": ["600"],
    });
  });

  it("replaces Clerk's own CORS headers rather than adding a second set", () => {
    // Two Access-Control-Allow-Origin values in one response is a CORS failure.
    const headers = withRendererCorsForNativeClerkResponse(
      NATIVE_CLERK_URL,
      {
        "access-control-allow-origin": ["https://relay.democrat"],
        "Access-Control-Expose-Headers": ["X-Something"],
        "Content-Type": ["application/json"],
      },
      RENDERER_ORIGIN,
      FRONTEND_API_HOST,
    );

    expect(Object.keys(headers).filter((name) => /allow-origin/i.test(name))).toEqual([
      "Access-Control-Allow-Origin",
    ]);
    expect(headers["Access-Control-Allow-Origin"]).toEqual([RENDERER_ORIGIN]);
    expect(headers["Access-Control-Expose-Headers"]).toEqual(["Authorization, Clerk-Db-Jwt, *"]);
    expect(headers["Content-Type"]).toEqual(["application/json"]);
  });

  it("does not alter ordinary Clerk responses or another instance's responses", () => {
    const headers = { "Content-Type": ["application/json"] };

    expect(
      withRendererCorsForNativeClerkResponse(
        `https://${FRONTEND_API_HOST}/v1/client`,
        headers,
        RENDERER_ORIGIN,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
    expect(
      withRendererCorsForNativeClerkResponse(
        "https://next-boa-5954.clerk.accounts.dev/v1/client?_is_native=1",
        headers,
        RENDERER_ORIGIN,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
  });

  it("passes an unparseable url through instead of throwing inside the callback", () => {
    const headers = { "Content-Type": ["application/json"] };

    expect(
      withRendererCorsForNativeClerkResponse(
        "not a url",
        headers,
        RENDERER_ORIGIN,
        FRONTEND_API_HOST,
      ),
    ).toBe(headers);
  });
});
