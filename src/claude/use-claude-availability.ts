import { useCallback, useEffect, useState } from "react";

import type { ClaudeAvailability } from "@/shared/claude";
import { getDesktopBridge } from "./desktop-bridge";

/**
 * Claude runs locally, so availability is a machine fact rather than app state:
 * `null` means the check is still in flight.
 */
export function useClaudeAvailability() {
  const [availability, setAvailability] = useState<ClaudeAvailability | null>(null);

  const refresh = useCallback(async function checkClaude() {
    setAvailability(null);
    const bridge = getDesktopBridge();
    if (!bridge) {
      setAvailability({
        isInstalled: false,
        isAuthenticated: false,
        executablePath: null,
        version: null,
        problem: "Open ERM in the desktop app to use Claude.",
      });
      return;
    }
    try {
      setAvailability(await bridge.checkClaudeAvailability());
    } catch (caught) {
      setAvailability({
        isInstalled: false,
        isAuthenticated: false,
        executablePath: null,
        version: null,
        problem: caught instanceof Error ? caught.message : "Could not check local Claude.",
      });
    }
  }, []);

  useEffect(function checkOnMount() {
    void refresh();
  }, [refresh]);

  return { availability, refresh };
}
