import { useEffect, useState } from "react";

import { describeClaudeRuntimeEvent } from "@/claude/claude-activity";
import { getDesktopBridge } from "@/claude/desktop-bridge";

/**
 * The one line worth showing while Claude works: what it is doing right now.
 * A spinner alone says "wait"; "Reading the Miro board" says the work is real and
 * roughly how far along it is.
 */
export function useClaudeProgress(requestId: string | null) {
  const [step, setStep] = useState<string | null>(null);

  useEffect(function followRuntimeEvents() {
    if (!requestId) {
      setStep(null);
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge) return;

    return bridge.onClaudeRuntimeEvent((event) => {
      if (event.requestId !== requestId) return;
      const activity = describeClaudeRuntimeEvent(event);
      setStep(activity.label);
    });
  }, [requestId]);

  return step;
}
