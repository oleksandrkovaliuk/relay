import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ClaudeActivityRow } from "@/claude/claude-activity-row";
import type { ClaudeActivityKind } from "@/claude/claude-activity";
import { Button } from "@/components/ui/button";
import { formatElapsedSeconds } from "@/lib/utils";

const ELAPSED_TICK_MILLISECONDS = 1_000;
/** Past this, a run is almost certainly a closed window rather than slow work. */
const STALLED_AFTER_MILLISECONDS = 10 * 60 * 1_000;

const ACTIVITY_KINDS: readonly ClaudeActivityKind[] = [
  "request",
  "runtime",
  "tool",
  "streaming",
  "authentication",
  "completion",
  "cancelled",
  "failed",
];

/**
 * Generation happens in the desktop process and regularly outlasts a teacher's
 * patience, so the library always shows what is still being written — including
 * the step Claude is on right now.
 */
export function GeneratingHomework() {
  const activeJobs = useQuery(api.aiJobs.listActive);
  const finishJob = useMutation(api.aiJobs.finishWithError);
  const [now, setNow] = useState(() => Date.now());
  const hasActiveJobs = Boolean(activeJobs && activeJobs.length > 0);

  useEffect(function tickWhileGenerating() {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => setNow(Date.now()), ELAPSED_TICK_MILLISECONDS);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs]);

  if (!activeJobs || activeJobs.length === 0) return null;

  async function dismiss(aiJobId: Id<"aiJobs">) {
    await finishJob({
      aiJobId,
      status: "cancelled",
      errorMessage: "The generation was dismissed from the homework library.",
    }).catch(() => undefined);
  }

  return (
    <section
      className="status-enter panel divide-y divide-border/70 overflow-hidden"
      aria-label="Homework being generated"
    >
      <p className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground xl:px-6">
        Generating
      </p>
      {activeJobs.map((job) => {
        const elapsedMilliseconds = Math.max(0, now - (job.startedAt ?? job.createdAt));
        const isStalled = elapsedMilliseconds > STALLED_AFTER_MILLISECONDS;
        const activity = job.latestActivity;

        return (
          <article key={job._id} className="grid gap-2 px-5 py-4 xl:px-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-[-0.01em]">
                {job.title}
              </p>
              <p className="shrink-0 text-[12px] text-muted-foreground numeric">
                {formatElapsedSeconds(Math.floor(elapsedMilliseconds / 1_000))}
              </p>
              {isStalled ? (
                <Button variant="ghost" size="xs" onClick={() => void dismiss(job._id)}>
                  Dismiss
                </Button>
              ) : null}
            </div>

            {isStalled ? (
              <p className="text-[12.5px] leading-5 text-muted-foreground">
                Stopped reporting — the desktop app was probably closed.
              </p>
            ) : (
              <ClaudeActivityRow
                kind={toActivityKind(activity?.kind)}
                label={activity?.label ?? "Queued on the local Claude runtime"}
                detail={activity?.detail}
                isActive
                trailing={
                  job.activityCount && job.activityCount > 1
                    ? `${job.activityCount} steps`
                    : undefined
                }
              />
            )}
          </article>
        );
      })}
    </section>
  );
}

/** The stored kind is a plain string, so narrow it without asserting. */
function toActivityKind(kind: string | undefined): ClaudeActivityKind {
  return ACTIVITY_KINDS.find((candidate) => candidate === kind) ?? "request";
}
