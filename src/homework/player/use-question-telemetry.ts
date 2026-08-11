import { useCallback, useEffect, useRef, useState } from "react";

export interface QuestionTelemetry {
  activeMs: number;
  lookupCount: number;
  revisionCount: number;
}

const EMPTY_TELEMETRY: QuestionTelemetry = { activeMs: 0, lookupCount: 0, revisionCount: 0 };

function isDocumentEngaged() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Measures engaged time per question rather than wall-clock time, and counts the
 * times the student left the tab — the signal that separates "thought about it"
 * from "looked it up".
 */
export function useQuestionTelemetry(questionKey: string) {
  const [lookupCount, setLookupCount] = useState(0);
  const revisionCount = useRef(0);
  const accumulatedMs = useRef(0);
  const engagedSince = useRef<number | null>(null);

  const settleEngagedTime = useCallback(() => {
    if (engagedSince.current === null) return;
    accumulatedMs.current += Date.now() - engagedSince.current;
    engagedSince.current = null;
  }, []);

  useEffect(() => {
    accumulatedMs.current = 0;
    revisionCount.current = 0;
    setLookupCount(0);
    engagedSince.current = isDocumentEngaged() ? Date.now() : null;

    function handleDisengage() {
      settleEngagedTime();
      setLookupCount((current) => current + 1);
    }

    function handleEngage() {
      if (engagedSince.current === null) engagedSince.current = Date.now();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") handleEngage();
      else handleDisengage();
    }

    window.addEventListener("blur", handleDisengage);
    window.addEventListener("focus", handleEngage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleDisengage);
      window.removeEventListener("focus", handleEngage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      settleEngagedTime();
    };
  }, [questionKey, settleEngagedTime]);

  const countRevision = useCallback(() => {
    revisionCount.current += 1;
  }, []);

  const readTelemetry = useCallback((): QuestionTelemetry => {
    const engagedMs =
      engagedSince.current === null ? 0 : Date.now() - engagedSince.current;
    return {
      activeMs: accumulatedMs.current + engagedMs,
      lookupCount,
      revisionCount: revisionCount.current,
    };
  }, [lookupCount]);

  return { countRevision, readTelemetry, lookupCount };
}

export { EMPTY_TELEMETRY };
