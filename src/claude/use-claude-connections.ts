import { useCallback, useEffect, useState } from "react";

import type { ClaudeConnection, TeacherDesktopApi } from "@/shared/claude";
import { getDesktopBridge } from "./desktop-bridge";

const NO_BRIDGE_PROBLEM = "Open Relay in the desktop app to manage Claude accounts.";
const STALE_BRIDGE_PROBLEM =
  "This desktop build predates Claude account switching. Quit Relay and start it again to load it.";

/**
 * The teacher's Claude logins live in the desktop process, so the renderer keeps
 * a mirror and re-reads it after every change rather than guessing the result.
 */
export function useClaudeConnections() {
  const [connections, setConnections] = useState<ClaudeConnection[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async function readConnections() {
    setProblem(null);
    try {
      const state = await requireConnectionsBridge().listClaudeConnections();
      setConnections(state.connections);
    } catch (caught) {
      setConnections(null);
      setProblem(describeProblem(caught));
    }
  }, []);

  useEffect(function readOnMount() {
    void refresh();
  }, [refresh]);

  /** Runs one change and adopts the state the desktop process reports back. */
  const apply = useCallback(async function applyChange(
    change: (bridge: TeacherDesktopApi) => Promise<{ connections: ClaudeConnection[] }>,
  ) {
    setProblem(null);
    try {
      const state = await change(requireConnectionsBridge());
      setConnections(state.connections);
    } catch (caught) {
      setProblem(describeProblem(caught));
    }
  }, []);

  return {
    connections,
    problem,
    activeConnection: connections?.find((connection) => connection.isActive) ?? null,
    refresh,
    addConnection: (label: string) => apply((bridge) => bridge.addClaudeConnection(label)),
    activateConnection: (id: string) => apply((bridge) => bridge.activateClaudeConnection(id)),
    removeConnection: (id: string) => apply((bridge) => bridge.removeClaudeConnection(id)),
    readLoginCommand: async (id: string) => {
      try {
        return await requireConnectionsBridge().claudeLoginCommand(id);
      } catch (caught) {
        setProblem(describeProblem(caught));
        return null;
      }
    },
  };
}

/**
 * The preload bundle is versioned separately from the renderer, so a running app
 * can expose an older API than the UI expects. Failing loudly here turns a
 * confusing empty panel into an instruction the teacher can act on.
 */
function requireConnectionsBridge(): TeacherDesktopApi {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error(NO_BRIDGE_PROBLEM);
  if (typeof bridge.listClaudeConnections !== "function") throw new Error(STALE_BRIDGE_PROBLEM);
  return bridge;
}

function describeProblem(caught: unknown) {
  if (caught instanceof Error) {
    // A missing IPC handler means main is running older code than the renderer.
    if (caught.message.includes("No handler registered")) return STALE_BRIDGE_PROBLEM;
    return caught.message;
  }
  return "Could not read Claude accounts.";
}
