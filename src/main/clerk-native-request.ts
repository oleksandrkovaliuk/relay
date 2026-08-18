export type RequestHeaders = Record<string, string>;

function findHeaderName(headers: RequestHeaders, expectedName: string) {
  const normalizedExpectedName = expectedName.toLowerCase();
  return Object.keys(headers).find((name) => name.toLowerCase() === normalizedExpectedName);
}

export function withoutBrowserOriginForNativeClerkRequest(
  requestUrl: string,
  requestHeaders: RequestHeaders,
) {
  const url = new URL(requestUrl);
  const isNativeClerkRequest = url.searchParams.get("_is_native") === "1";
  const originHeader = findHeaderName(requestHeaders, "origin");

  if (!isNativeClerkRequest || !originHeader) return requestHeaders;

  const headersWithoutOrigin = { ...requestHeaders };
  delete headersWithoutOrigin[originHeader];
  return headersWithoutOrigin;
}
