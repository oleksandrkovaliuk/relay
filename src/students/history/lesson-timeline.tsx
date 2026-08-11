import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn, formatRelativeTime } from "@/lib/utils";

/** Near-instant, so scrubbing the rail feels like reading rather than waiting. */
const PREVIEW_OPEN_DELAY_MILLISECONDS = 30;
const PREVIEW_CLOSE_DELAY_MILLISECONDS = 60;

export type StudentHistory = NonNullable<
  ReturnType<typeof useQuery<typeof api.students.history>>
>;
export type StudentHistoryEntry = StudentHistory[number];

/**
 * A dense rail of hairlines — one per lesson, newest first. Width and weight
 * carry the state, so the whole history reads at a glance and the detail lives
 * in the preview card rather than on the page.
 */
export function LessonTimeline({
  history,
  now,
  selectedSubmissionId,
  onPrewarm,
  onSelect,
}: {
  history: StudentHistory | undefined;
  now: number;
  selectedSubmissionId: Id<"submissions"> | null;
  onPrewarm: (submissionId: Id<"submissions">) => void;
  onSelect: (submissionId: Id<"submissions">) => void;
}) {
  if (history === undefined) {
    return (
      <div className="grid gap-2 py-2 pl-2" aria-label="Loading lessons">
        {["first", "second", "third", "fourth"].map((key) => (
          <span key={key} className="h-px w-3 animate-pulse rounded-full bg-foreground/15" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="py-2 pl-2">
        <span aria-hidden className="block h-px w-2.5 bg-foreground/12" />
        <span className="sr-only">No lesson activity yet</span>
      </div>
    );
  }

  return (
    <ol aria-label="Lesson history" className="grid py-1">
      {history.map((entry) => {
        const isSelected = entry.submissionId === selectedSubmissionId;
        const isSubmitted = entry.status === "submitted";
        return (
          <li key={entry.submissionId}>
            <HoverCard>
              <HoverCardTrigger
                delay={PREVIEW_OPEN_DELAY_MILLISECONDS}
                closeDelay={PREVIEW_CLOSE_DELAY_MILLISECONDS}
                render={
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`${entry.assignmentTitle}. ${isSubmitted ? "Submitted" : "In progress"}. Open lesson.`}
                    onPointerEnter={() => onPrewarm(entry.submissionId)}
                    onPointerDown={() => onPrewarm(entry.submissionId)}
                    onFocus={() => onPrewarm(entry.submissionId)}
                    onClick={() => onSelect(entry.submissionId)}
                    className="group/dash flex h-3 w-full items-center pl-2 pr-1 outline-none"
                  />
                }
              >
                <span
                  aria-hidden
                  className={cn(
                    "rounded-full transition-[width,height,background-color] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none",
                    "group-focus-visible/dash:ring-2 group-focus-visible/dash:ring-ring group-focus-visible/dash:ring-offset-4 group-focus-visible/dash:ring-offset-background",
                    /* The current lesson is a capsule; everything else is a
                       hairline whose width says whether it was finished. */
                    isSelected
                      ? "h-1.5 w-6 bg-foreground ring-2 ring-background"
                      : isSubmitted
                        ? "h-px w-3.5 bg-foreground/30 group-hover/dash:w-5 group-hover/dash:bg-foreground/60"
                        : "h-px w-2 bg-foreground/20 group-hover/dash:w-4 group-hover/dash:bg-foreground/45",
                  )}
                />
              </HoverCardTrigger>
              <LessonPreviewCard entry={entry} now={now} />
            </HoverCard>
          </li>
        );
      })}
    </ol>
  );
}

function LessonPreviewCard({ entry, now }: { entry: StudentHistoryEntry; now: number }) {
  const summary = entry.summaryText ?? getHistoryFallbackSummary(entry);

  return (
    <HoverCardContent
      side="right"
      align="start"
      alignOffset={-10}
      sideOffset={10}
      className="w-[18rem] rounded-2xl p-0"
    >
      <div className="px-3.5 pt-3 pb-2.5">
        <p className="line-clamp-2 text-pretty text-[13px] font-semibold leading-5 text-foreground">
          {entry.assignmentTitle}
        </p>
        <p className="mt-1.5 line-clamp-3 text-pretty text-[12px] leading-[17px] text-muted-foreground">
          {summary}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3.5 py-2 text-[11px]">
        <span
          className={cn(
            "font-medium",
            entry.status === "submitted" ? "text-primary" : "text-muted-foreground",
          )}
        >
          {entry.status === "submitted" ? "Submitted" : "In progress"}
        </span>
        <span className="shrink-0 text-muted-foreground numeric">
          {formatRelativeTime(entry.submittedAt ?? entry.startedAt, now)}
        </span>
      </div>
    </HoverCardContent>
  );
}

function getHistoryFallbackSummary(entry: StudentHistoryEntry) {
  if (entry.status === "in_progress") return "The student is still working through this lesson.";
  if (entry.score === undefined) return "Submitted and waiting for a final grade.";
  return `${entry.score} of ${entry.maxAutoScore} auto-graded points.`;
}
