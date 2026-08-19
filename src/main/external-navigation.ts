/**
 * Guards the hand-off of a navigation to the user's real browser.
 *
 * Relay opens external pages — Clerk's hosted pages, OAuth providers — in the system
 * browser rather than in the renderer. A misconfigured redirect turns that into a weapon:
 * clerk-js pointing the window at a URL Relay refuses to load produced an endless loop of
 * browser tabs. The root cause is fixed by giving Clerk in-app redirect targets, but
 * nothing else stands between a repeated navigation and the user's desktop, so a repeat of
 * the same URL inside a short window is dropped.
 */
const DEFAULT_REPEAT_WINDOW_MS = 2_000;

export function createExternalNavigationGuard(options: {
  now: () => number;
  repeatWindowMs?: number;
}) {
  const repeatWindowMs = options.repeatWindowMs ?? DEFAULT_REPEAT_WINDOW_MS;
  let lastUrl: string | null = null;
  let lastOpenedAt = 0;

  return {
    /** True the first time a url is seen, and again only once the window has elapsed. */
    shouldOpen(targetUrl: string) {
      const now = options.now();
      if (targetUrl === lastUrl && now - lastOpenedAt < repeatWindowMs) return false;
      lastUrl = targetUrl;
      lastOpenedAt = now;
      return true;
    },
  };
}
