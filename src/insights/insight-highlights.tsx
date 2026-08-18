import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, ArrowRight, Lightbulb, Sparkles } from "lucide-react";

import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type InsightHighlight = FunctionReturnType<typeof api.dashboard.highlights>[number];

const TONE_STYLES = {
  attention: { icon: AlertTriangle, color: "text-destructive", border: "border-destructive/25" },
  neutral: { icon: Lightbulb, color: "text-secondary-foreground", border: "border-border" },
  positive: { icon: Sparkles, color: "text-primary", border: "border-primary/25" },
} as const;

/** The verb for each finding: what the teacher would do about it, in one word. */
const ACTION_LABELS: Record<InsightHighlight["kind"], string> = {
  pending_review: "Read answers",
  stalled: "Open the set",
  hesitation: "Review answers",
  slipping: "Review answers",
  skill_gap: "Plan follow-up",
  skill_strength: "Review answers",
};

/**
 * A finding, written as a sentence a teacher can act on, carrying the action
 * itself. A finding without a way through is just a fact: "19 answers waiting on
 * you" is only useful next to the button that opens them.
 */
export function InsightHighlightCard({
  highlight,
  onOpenSubmission,
}: {
  highlight: InsightHighlight;
  onOpenSubmission?: (submissionId: Id<"submissions">) => void;
}) {
  const { icon: Icon, color, border } = TONE_STYLES[highlight.tone];
  const submissionId = highlight.submissionId;
  const label = ACTION_LABELS[highlight.kind];
  /**
   * A skill gap belongs to no single submission — the answer to it is more
   * practice, so it leads to the builder with that student already chosen.
   */
  const isPlanning = highlight.kind === "skill_gap" && Boolean(highlight.studentId);
  const canOpenSubmission = Boolean(submissionId && onOpenSubmission);

  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-xl border bg-card px-4 py-3.5 text-left",
        border,
      )}
    >
      <span className={cn("mt-0.5 shrink-0", color)}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-[13.5px] font-semibold text-foreground xl:text-[14.5px]">
            {highlight.title}
          </p>
          {highlight.value ? (
            <span className={cn("shrink-0 text-[13px] font-semibold numeric", color)}>
              {highlight.value}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-pretty text-[12.5px] leading-5 text-secondary-foreground xl:text-[13.5px]">
          {highlight.detail}
        </p>
        {isPlanning && highlight.studentId ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1.5"
            nativeButton={false}
            render={
              <Link to="/homework/new" search={{ studentId: highlight.studentId }} />
            }
          >
            {label}
            <ArrowRight size={13} aria-hidden />
          </Button>
        ) : canOpenSubmission && submissionId ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1.5"
            onClick={() => onOpenSubmission?.(submissionId)}
          >
            {label}
            <ArrowRight size={13} aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function InsightHighlightList({
  highlights,
  className,
  onOpenSubmission,
}: {
  highlights: InsightHighlight[];
  className?: string;
  onOpenSubmission?: (submissionId: Id<"submissions">) => void;
}) {
  return (
    <div className={cn("grid gap-2.5", className)}>
      {highlights.map((highlight) => (
        <InsightHighlightCard
          key={highlight.key}
          highlight={highlight}
          onOpenSubmission={onOpenSubmission}
        />
      ))}
    </div>
  );
}

export function InsightHighlightsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3.5 w-10" />
          </div>
          <Skeleton className="mt-2.5 h-3 w-full max-w-[28rem]" />
        </div>
      ))}
    </div>
  );
}

/** Shown when the data genuinely has nothing worth flagging. */
export function InsightHighlightsEmpty({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
      <p className="text-[13.5px] font-medium text-foreground">Nothing needs your attention</p>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-5 text-secondary-foreground">
        {isFiltered
          ? "No graded work in this period. Try a wider range."
          : "Findings appear as students submit work — a skill slipping, answers waiting to be graded, a set left unfinished."}
      </p>
    </div>
  );
}
