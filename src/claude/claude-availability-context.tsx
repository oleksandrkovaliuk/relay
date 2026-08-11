import { createContext, useContext, type ReactNode } from "react";

import type { ClaudeAvailability } from "@/shared/claude";
import { useClaudeAvailability } from "./use-claude-availability";

type ClaudeAvailabilityValue = {
  availability: ClaudeAvailability | null;
  refresh: () => Promise<void>;
};

const ClaudeAvailabilityContext = createContext<ClaudeAvailabilityValue | null>(null);

/**
 * The availability check is an IPC round-trip to the local Claude CLI, so the
 * whole workspace shares one result instead of every page asking again.
 */
export function ClaudeAvailabilityProvider({ children }: { children: ReactNode }) {
  const value = useClaudeAvailability();

  return (
    <ClaudeAvailabilityContext.Provider value={value}>
      {children}
    </ClaudeAvailabilityContext.Provider>
  );
}

export function useSharedClaudeAvailability() {
  const value = useContext(ClaudeAvailabilityContext);
  if (!value) {
    throw new Error("useSharedClaudeAvailability requires a ClaudeAvailabilityProvider.");
  }
  return value;
}
