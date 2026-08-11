import { useEffect, useState } from "react";

const DEFAULT_TICK_MILLISECONDS = 30_000;

/**
 * Relative timestamps ("12m ago") go stale on their own, so views that show
 * them keep a ticking clock instead of reading the wall clock while rendering.
 */
export function useNow(tickMilliseconds = DEFAULT_TICK_MILLISECONDS) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(function tickTheClock() {
    const interval = window.setInterval(() => setNow(Date.now()), tickMilliseconds);
    return () => window.clearInterval(interval);
  }, [tickMilliseconds]);

  return now;
}
