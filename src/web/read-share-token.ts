const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * Accepts both `/h/<token>` paths and `?h=<token>` queries so the same static
 * bundle works whether the host rewrites unknown paths to index.html or not.
 */
export function readShareToken(location: { pathname: string; search: string }) {
  const fromQuery = new URLSearchParams(location.search).get("h");
  if (fromQuery && SHARE_TOKEN_PATTERN.test(fromQuery)) return fromQuery;

  const lastPathSegment = location.pathname.split("/").filter(Boolean).at(-1);
  if (lastPathSegment && SHARE_TOKEN_PATTERN.test(lastPathSegment)) return lastPathSegment;

  return null;
}
