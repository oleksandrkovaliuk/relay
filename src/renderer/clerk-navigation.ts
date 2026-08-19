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

/**
 * Builds Clerk's `routerPush` / `routerReplace` callbacks.
 *
 * Clerk awaits whatever these return, so they must return `undefined` rather than a promise.
 * Awaiting the router wedged sign-out: `<Authenticated>` unmounts the router the moment the
 * session ends, so nothing remained to complete the navigation and its promise never settled,
 * leaving `signOut()` permanently in flight. Relay renders from auth state, not the URL, so
 * Clerk never needs to wait on routing.
 */
export function createClerkRouterCallbacks(options: {
  navigate: (path: string, options: { replace?: boolean }) => unknown;
  onError?: (path: string, cause: unknown) => void;
}) {
  const start = (target: string, replace?: boolean): undefined => {
    const path = toRendererPath(target);
    if (!path) return;

    try {
      void Promise.resolve(options.navigate(path, { replace })).catch((cause: unknown) => {
        options.onError?.(path, cause);
      });
    } catch (cause) {
      // A synchronous throw must not surface either; Clerk is mid-flow.
      options.onError?.(path, cause);
    }
  };

  return {
    routerPush: (target: string) => start(target),
    routerReplace: (target: string) => start(target, true),
  };
}
