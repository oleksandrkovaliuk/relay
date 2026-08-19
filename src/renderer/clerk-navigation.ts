import { RENDERER_ORIGIN } from "@/shared/renderer-origin";

/**
 * Clerk hands its router callbacks fully-built URLs — `relay://renderer/` for the
 * post-auth destination, sometimes a bare path. TanStack's `href` option is meant for
 * external targets, so passing an absolute app URL to it attempted a real browser
 * navigation from inside Clerk's sign-in/sign-out flow. That left the flow unresolved and
 * the app stuck on "Connecting securely…".
 *
 * Reduce whatever Clerk passes to an in-app path, or null when it points somewhere that is
 * not this renderer. Relay gates on auth state rather than the URL, so a destination
 * outside the app is nothing to navigate to.
 */
export function toRendererPath(target: string) {
  const trimmed = target.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (`${url.protocol}//${url.host}` !== RENDERER_ORIGIN) return null;
  return `${url.pathname}${url.search}${url.hash}` || "/";
}
