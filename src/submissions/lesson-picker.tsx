import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn, formatRelativeTime } from "@/lib/utils";

export type StudentHistory = NonNullable<
  ReturnType<typeof useQuery<typeof api.students.history>>
>;
export type StudentHistoryEntry = StudentHistory[number];

/**
 * The list of this student's homework, newest first, as one selectable card
 * each. It replaces a rail of hairlines: that read as decoration, so nobody
 * could tell it was the control the page is driven with, or which lesson they
 * were looking at.
 */
export function LessonPicker({
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
      <div className="grid gap-2" aria-label="Loading lessons">
        {["first", "second", "third"].map((key) => (
          <span key={key} className="h-16 animate-pulse rounded-xl bg-foreground/6" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-[12.5px] leading-5 text-muted-foreground">
        No homework yet.
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Homework history" className="grid gap-1.5">
      {history.map((entry) => {
        const isSelected = entry.submissionId === selectedSubmissionId;
        return (
          <button
            key={entry.submissionId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onPointerEnter={() => onPrewarm(entry.submissionId)}
            onFocus={() => onPrewarm(entry.submissionId)}
            onClick={() => onSelect(entry.submissionId)}
            className={cn(
              /* Selection is carried by the card itself — the tint and its
                 border are the whole signal, with nothing drawn down the edge
                 to compete with the step rail beside it. */
              "w-full rounded-xl border px-3 py-2.5 text-left outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary/45 bg-primary-soft/70"
                : "border-transparent hover:border-border hover:bg-muted/50",
            )}
          >
            <span className="block min-w-0">
              <span
                className={cn(
                  "line-clamp-2 text-pretty text-[12.5px] font-medium leading-[17px]",
                  isSelected ? "text-foreground" : "text-secondary-foreground",
                )}
              >
                {entry.assignmentTitle}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted-foreground">
                <span className={entry.status === "submitted" ? "text-primary" : undefined}>
                  {describeLessonResult(entry)}
                </span>
                <span aria-hidden>·</span>
                <span className="numeric">
                  {formatRelativeTime(entry.submittedAt ?? entry.startedAt, now)}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The one fact worth carrying in a list: how it went, or that it has not. */
function describeLessonResult(entry: StudentHistoryEntry) {
  if (entry.status !== "submitted") return "In progress";
  if (entry.score === undefined) return "Submitted";
  if (entry.maxAutoScore === 0) return "Submitted";
  return `${Math.round((entry.score / entry.maxAutoScore) * 100)}%`;
}
