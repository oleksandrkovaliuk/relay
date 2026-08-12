import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useRef } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getDesktopBridge } from "@/claude/desktop-bridge";

/**
 * Summarises a submission as soon as it arrives, rather than when the teacher
 * eventually clicks. Generation only exists on the teacher's Mac, so the desktop
 * app is what notices: it watches for submitted work with no summary yet and
 * works through the backlog one at a time.
 *
 * Deliberately serial. Each summary is a Claude request against the local CLI;
 * running several at once would compete for the same runtime and make every one
 * of them slower.
 */
export function useAutomaticSummaries({ isClaudeReady }: { isClaudeReady: boolean }) {
  const convex = useConvex();
  const awaiting = useQuery(api.feed.awaitingSummary, isClaudeReady ? {} : "skip");
  const attachAiSummary = useMutation(api.submissions.attachAiSummary);
  const isSummarizing = useRef(false);
  /** Never retried in a loop: a submission Claude cannot summarise is skipped. */
  const failedSubmissions = useRef(new Set<string>());

  useEffect(function summariseNewSubmissions() {
    if (!isClaudeReady || !awaiting || awaiting.length === 0) return;
    if (isSummarizing.current) return;
    const bridge = getDesktopBridge();
    if (!bridge) return;

    const next = awaiting.find(
      (submission) => !failedSubmissions.current.has(submission.submissionId),
    );
    if (!next) return;

    let isActive = true;
    isSummarizing.current = true;

    void (async function summarise() {
      try {
        const summaryInput = await convex.query(api.feed.summaryInput, {
          submissionId: next.submissionId as Id<"submissions">,
        });
        if (!summaryInput) return;
        const result = await bridge.summarizeSubmission({
          requestId: crypto.randomUUID(),
          ...summaryInput,
        });
        await attachAiSummary({
          submissionId: next.submissionId,
          summary: { ...result.summary, generatedAt: Date.now() },
        });
      } catch {
        // The teacher can still ask for it by hand from the activity row.
        failedSubmissions.current.add(next.submissionId);
      } finally {
        isSummarizing.current = false;
        // The subscription updating is what schedules the next one, so nothing
        // here needs to loop.
        if (!isActive) return;
      }
    })();

    return () => {
      isActive = false;
    };
  }, [attachAiSummary, awaiting, convex, isClaudeReady]);

  return {
    pendingCount: awaiting?.length ?? 0,
  };
}
