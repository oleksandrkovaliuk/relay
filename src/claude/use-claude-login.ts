import { useCallback, useEffect, useRef, useState } from "react";

import { getDesktopBridge } from "./desktop-bridge";

export type LoginStage =
  | { kind: "idle" }
  | { kind: "starting"; connectionId: string }
  | { kind: "browser"; connectionId: string; url: string }
  | { kind: "code"; connectionId: string; url: string | null }
  | { kind: "submitting"; connectionId: string }
  | { kind: "done"; connectionId: string }
  | { kind: "failed"; connectionId: string; message: string };

/**
 * Runs `claude auth login` inside the app. The CLI opens the browser itself and
 * then waits on stdin for the code the browser shows, so the only thing the
 * teacher does here is paste that one code — no terminal.
 */
export function useClaudeLogin({ onCompleted }: { onCompleted: () => void }) {
  const [stage, setStage] = useState<LoginStage>({ kind: "idle" });
  const connectionIdRef = useRef<string | null>(null);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(function subscribeToLoginEvents() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.onClaudeLoginEvent !== "function") return;

    return bridge.onClaudeLoginEvent((event) => {
      const connectionId = connectionIdRef.current;
      if (!connectionId) return;

      if (event.type === "browser_opened") {
        setStage({ kind: "browser", connectionId, url: event.url });
        return;
      }
      if (event.type === "code_requested") {
        setStage((current) => ({
          kind: "code",
          connectionId,
          url: current.kind === "browser" ? current.url : null,
        }));
        return;
      }
      if (event.type === "completed") {
        connectionIdRef.current = null;
        setStage({ kind: "done", connectionId });
        onCompletedRef.current();
        return;
      }
      if (event.type === "failed") {
        connectionIdRef.current = null;
        setStage({ kind: "failed", connectionId, message: event.message });
      }
    });
  }, []);

  const start = useCallback(async function startLogin(connectionId: string) {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.startClaudeLogin !== "function") {
      setStage({
        kind: "failed",
        connectionId,
        message: "Quit Relay and start it again to enable in-app sign-in.",
      });
      return;
    }
    connectionIdRef.current = connectionId;
    setStage({ kind: "starting", connectionId });
    try {
      await bridge.startClaudeLogin({ id: connectionId });
    } catch (caught) {
      connectionIdRef.current = null;
      setStage({
        kind: "failed",
        connectionId,
        message: caught instanceof Error ? caught.message : "Could not start the sign-in.",
      });
    }
  }, []);

  const submitCode = useCallback(async function submit(code: string) {
    const bridge = getDesktopBridge();
    const connectionId = connectionIdRef.current;
    if (!bridge || !connectionId) return;
    setStage({ kind: "submitting", connectionId });
    try {
      await bridge.submitClaudeLoginCode(code);
    } catch (caught) {
      setStage({
        kind: "failed",
        connectionId,
        message: caught instanceof Error ? caught.message : "That code was not accepted.",
      });
    }
  }, []);

  const cancel = useCallback(async function cancelLogin() {
    const bridge = getDesktopBridge();
    connectionIdRef.current = null;
    setStage({ kind: "idle" });
    if (bridge && typeof bridge.cancelClaudeLogin === "function") {
      await bridge.cancelClaudeLogin().catch(() => undefined);
    }
  }, []);

  return { stage, start, submitCode, cancel };
}
