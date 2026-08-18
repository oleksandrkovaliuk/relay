export type RequestHeaders = Record<string, string>;
export type ResponseHeaders = Record<string, string | string[]>;

/**
 * Clerk's Electron SDK marks every Frontend API call it makes with this query
 * parameter, so it distinguishes Clerk's native transport from any other request
 * the renderer happens to make to the same host.
 */
const NATIVE_TRANSPORT_MARKER = "_is_native";

/**
 * `@clerk/electron` persists the rotating client JWT by reading the `Authorization`
 * response header. That header is not CORS-safelisted, so without exposing it the
 * renderer reads `null` and the session is never saved. `Clerk-Db-Jwt` is the
 * equivalent header on development instances.
 *
 * The bare `*` covers any header Clerk adds later, but the spec deliberately
 * excludes `Authorization` from `*`, so it must also be named explicitly. Both
 * wildcards are only honoured for requests that omit credentials, which is exactly
 * what Clerk's native transport does (`request.credentials = "omit"`).
 */
const EXPOSED_RESPONSE_HEADERS = "Authorization, Clerk-Db-Jwt, *";
const ALLOWED_REQUEST_HEADERS = "Authorization, *";
const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
/**
 * The `Authorization` request header is not safelisted, so every authenticated Clerk call
 * is preceded by a preflight. Letting Chromium cache the result keeps that to one extra
 * round trip per ten minutes rather than one per request.
 */
const PREFLIGHT_CACHE_SECONDS = "600";

function findHeaderName(headers: object, expectedName: string) {
  const normalizedExpectedName = expectedName.toLowerCase();
  return Object.keys(headers).find((name) => name.toLowerCase() === normalizedExpectedName);
}

/**
 * `details.url` comes from Chromium and is always absolute, but a malformed value
 * would otherwise throw inside a webRequest callback and wedge every later request.
 */
function isNativeClerkRequest(requestUrl: string, frontendApiHost: string) {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.host === frontendApiHost &&
    url.searchParams.get(NATIVE_TRANSPORT_MARKER) === "1"
  );
}

/**
 * Chromium adds `Origin: relay://renderer` to these requests because they cross origins,
 * and Clerk rejects that Origin two different ways: an authenticated request fails with
 * "only one of the 'Origin' and 'Authorization' headers should be provided", and a
 * production instance fails even unauthenticated with "the Request HTTP Origin header
 * must be equal to or a subdomain of the requesting URL", since the key is bound to
 * `relay.democrat`.
 *
 * Clerk accepts a request carrying *no* Origin at all — that is how any non-browser
 * client calls it — so the header is removed rather than rewritten. Removing it does not
 * placate Chromium, which tracks the request's origin internally; that is what
 * `withRendererCorsForNativeClerkResponse` is for.
 *
 * This includes CORS preflights. They cannot keep their Origin either, and Clerk answers
 * an OPTIONS without one; the injected response headers are what Chromium actually reads.
 */
export function withoutBrowserOriginForNativeClerkRequest(
  requestUrl: string,
  requestHeaders: RequestHeaders,
  frontendApiHost: string,
) {
  if (!isNativeClerkRequest(requestUrl, frontendApiHost)) return requestHeaders;

  const originHeader = findHeaderName(requestHeaders, "origin");
  if (!originHeader) return requestHeaders;

  const headersWithoutOrigin = { ...requestHeaders };
  delete headersWithoutOrigin[originHeader];
  return headersWithoutOrigin;
}

/**
 * Chromium still applies CORS to the response, and Clerk does not grant access to a
 * custom scheme, so grant it here — narrowed to Clerk's native transport and to the
 * Relay renderer's own origin.
 *
 * Clerk's own `Access-Control-*` headers are dropped rather than merged: two
 * `Access-Control-Allow-Origin` values in one response is a CORS failure, not a
 * wider allowance.
 */
export function withRendererCorsForNativeClerkResponse(
  requestUrl: string,
  responseHeaders: ResponseHeaders,
  rendererOrigin: string,
  frontendApiHost: string,
) {
  if (!isNativeClerkRequest(requestUrl, frontendApiHost)) return responseHeaders;

  const headersWithoutCors = Object.fromEntries(
    Object.entries(responseHeaders).filter(([name]) => !/^access-control-/i.test(name)),
  );

  return {
    ...headersWithoutCors,
    "Access-Control-Allow-Origin": [rendererOrigin],
    "Access-Control-Allow-Headers": [ALLOWED_REQUEST_HEADERS],
    "Access-Control-Allow-Methods": [ALLOWED_METHODS],
    "Access-Control-Expose-Headers": [EXPOSED_RESPONSE_HEADERS],
    "Access-Control-Max-Age": [PREFLIGHT_CACHE_SECONDS],
  };
}
