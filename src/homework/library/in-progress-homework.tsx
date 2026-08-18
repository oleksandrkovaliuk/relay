import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ClaudeActivityRow } from "@/claude/claude-activity-row";
import type { ClaudeActivityKind } from "@/claude/claude-activity";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { HomeworkGlyph } from "@/homework/homework-glyph";
import { useNow } from "@/lib/use-now";
import { cn, formatElapsedSeconds, formatRelativeTime } from "@/lib/utils";

/** More than this and the section stops being "what is happening right now". */
const MAXIMUM_VISIBLE_ATTEMPTS = 6;
/** A running generation is timed to the second, so its clock ticks that fast. */
const ELAPSED_TICK_MILLISECONDS = 1_000;
/** Nothing on the page moves by the second once the runs are done. */
const IDLE_TICK_MILLISECONDS = 60_000;
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
 * Two different kinds of "in progress", told apart.
 *
 * Homework Claude is still writing is the teacher's own unfinished work: it
 * needs waiting for, or dismissing. Homework a student has open is somebody
 * else's, mid-attempt, and the only thing to do with it is look. They were one
 * list, so a run that had stalled and a learner halfway through a worksheet sat
 * a row apart under the same heading and the same "live" count.
 */
export function InProgressHomework() {
  const activeJobs = useQuery(api.aiJobs.listActive);
  const inProgress = useQuery(api.feed.inProgress);
  const finishJob = useMutation(api.aiJobs.finishWithError);

  const jobs = activeJobs ?? [];
  const attempts = (inProgress ?? []).slice(0, MAXIMUM_VISIBLE_ATTEMPTS);
  /**
   * The seconds only move while something is generating. Ticking every second
   * for the rest of the day re-renders this list for no one.
   */
  const isTimingARun = jobs.some((job) => job.status !== "failed");
  const now = useNow(isTimingARun ? ELAPSED_TICK_MILLISECONDS : IDLE_TICK_MILLISECONDS);

  if (jobs.length === 0 && attempts.length === 0) return null;
  const runningJobs = jobs.filter((job) => job.status !== "failed").length;

  async function dismiss(aiJobId: Id<"aiJobs">) {
    await finishJob({
      aiJobId,
      status: "cancelled",
      errorMessage: "The generation was dismissed from the homework library.",
    }).catch(() => undefined);
  }

  return (
    <div className="grid gap-8">
    {jobs.length > 0 ? (
    <section className="status-enter grid gap-3">
      <SectionHeading
        title="Being written"
        description="Claude is drafting these. Nothing is shared until you review one."
        action={
          <span className="text-[13px] text-muted-foreground numeric">
            {runningJobs > 0 ? `${runningJobs} running` : `${jobs.length} to clear`}
          </span>
        }
      />
      <div className="panel divide-y divide-border/70 overflow-hidden">
        {jobs.map((job) => {
          const elapsedMilliseconds = Math.max(0, now - (job.startedAt ?? job.createdAt));
          const hasFailed = job.status === "failed";
          const isStalled = !hasFailed && elapsedMilliseconds > STALLED_AFTER_MILLISECONDS;
          const activity = job.latestActivity;

          return (
            <article key={job._id} className="grid gap-2 px-4 py-3.5 xl:px-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {/* An activity edit runs on the same runtime as a generation, so
                    it belongs in the same list — labelled for what it is. */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
                    hasFailed
                      ? "bg-critical-soft text-destructive"
                      : job.kind === "question_rewrite"
                        ? "bg-muted text-secondary-foreground"
                        : "bg-primary-soft text-primary",
                  )}
                >
                  {hasFailed ? "Failed" : job.kind === "question_rewrite" ? "Edit" : "New"}
                </span>
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-[-0.01em]">
                  {job.title}
                </p>
                {hasFailed ? null : (
                  <p className="shrink-0 text-[12px] text-muted-foreground numeric">
                    {formatElapsedSeconds(Math.floor(elapsedMilliseconds / 1_000))}
                  </p>
                )}
                {isStalled || hasFailed ? (
                  <Button variant="ghost" size="xs" onClick={() => void dismiss(job._id)}>
                    Dismiss
                  </Button>
                ) : null}
              </div>

              {hasFailed ? (
                <p className="text-pretty text-[12.5px] leading-5 text-destructive">
                  {job.errorMessage ?? "Generation failed."}
                </p>
              ) : isStalled ? (
                <p className="text-[12.5px] leading-5 text-muted-foreground">
                  Stopped reporting — the desktop app was probably closed.
                </p>
              ) : (
                <ClaudeActivityRow
                  kind={toActivityKind(activity?.kind)}
                  label={activity?.label ?? "Queued on the local Claude runtime"}
                  /**
                   * A whole set is written as one answer, so nothing is reported
                   * between the request and the result. Saying how long that
                   * normally takes is the only honest progress there is.
                   */
                  detail={activity?.detail ?? describeExpectedWait(job.kind)}
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
      </div>
    </section>
    ) : null}

    {attempts.length > 0 ? (
    <section className="status-enter grid gap-3">
      <SectionHeading
        title="With students now"
        description="Attempts a student has open. You are watching, not editing."
        action={
          <span className="text-[13px] text-muted-foreground numeric">
            {attempts.length} {attempts.length === 1 ? "student" : "students"}
          </span>
        }
      />
      <div className="panel divide-y divide-border/70 overflow-hidden">
        {attempts.map((attempt) => {
          const currentStep = Math.min(attempt.answeredCount + 1, attempt.questionCount);
          return (
            <article
              key={attempt.submissionId}
              className="group/row relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/35 xl:px-5"
            >
              <Link
                to="/submissions/$submissionId"
                params={{ submissionId: attempt.submissionId }}
                aria-label={`Open ${attempt.studentName}'s attempt at ${attempt.assignmentTitle}`}
                className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              />
              <HomeworkGlyph id={attempt.assignmentId} />
              <div className="pointer-events-none min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium tracking-[-0.01em]">
                  {attempt.studentName}
                  <span className="text-muted-foreground"> · {attempt.assignmentTitle}</span>
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground numeric">
                  {attempt.questionCount > 0
                    ? `On step ${currentStep} of ${attempt.questionCount}`
                    : "Not started"}{" "}
                  · started {formatRelativeTime(attempt.startedAt, now)}
                  {attempt.activeMinutes > 0 ? ` · ${attempt.activeMinutes} min active` : ""}
                </p>
              </div>
              <ProgressPips answered={attempt.answeredCount} total={attempt.questionCount} />
              {attempt.questionCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="relative z-10 shrink-0 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100"
                  nativeButton={false}
                  render={
                    <Link
                      to="/submissions/$submissionId"
                      params={{ submissionId: attempt.submissionId }}
                      search={{ step: currentStep }}
                    />
                  }
                >
                  Go to step {currentStep}
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
    ) : null}
    </div>
  );
}

function describeExpectedWait(kind: "homework_generation" | "question_rewrite") {
  return kind === "question_rewrite"
    ? "Usually under a minute"
    : "Usually 1–3 minutes — you can carry on working";
}

/** How far in they are, at a glance — the same rail the student is looking at. */
function ProgressPips({ answered, total }: { answered: number; total: number }) {
  if (total === 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none hidden shrink-0 items-center gap-1 sm:flex"
    >
      {Array.from({ length: Math.min(total, 12) }, (_, index) => (
        <span
          key={index}
          className={
            index < answered
              ? "block h-1.5 w-1.5 rounded-full bg-primary"
              : "block h-1.5 w-1.5 rounded-full bg-foreground/15"
          }
        />
      ))}
    </span>
  );
}

/** The stored kind is a plain string, so narrow it without asserting. */
function toActivityKind(kind: string | undefined): ClaudeActivityKind {
  return ACTIVITY_KINDS.find((candidate) => candidate === kind) ?? "request";
}
