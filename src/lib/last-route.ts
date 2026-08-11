const LAST_ROUTE_STORAGE_KEY = "erm:last-route:v1";

/**
 * The desktop renderer runs on memory history, so the router has no URL to read
 * on boot. Remembering the last path keeps a reload on the page you were using.
 */
export function rememberLastRoute(pathname: string) {
  try {
    window.sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, pathname);
  } catch {
    // Navigation must never fail because browser storage is unavailable.
  }
}

export function readLastRoute() {
  try {
    const stored = window.sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    return stored?.startsWith("/") ? stored : "/";
  } catch {
    return "/";
  }
}
