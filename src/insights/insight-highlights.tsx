import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, ArrowRight, Lightbulb, Sparkles } from "lucide-react";

import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type InsightHighlight = FunctionReturnType<typeof api.dashboard.highlights>[number];

const TONE_STYLES = {
  attention: { icon: AlertTriangle, color: "text-destructive", border: "border-destructive/25" },
  neutral: { icon: Lightbulb, color: "text-secondary-foreground", border: "border-border" },
  positive: { icon: Sparkles, color: "text-primary", border: "border-primary/25" },
} as const;

/**
 * A finding, written as a sentence a teacher can act on. Where the finding came
 * from one submission, the card opens it — the insight and the work are one tap
 * apart.
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
  const isActionable = Boolean(submissionId && onOpenSubmission);

  const body = (
    <>
      <span className={cn("mt-0.5 shrink-0", color)}>
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-[13.5px] font-semibold text-foreground xl:text-[14.5px]">
            {highlight.title}
          </span>
          {highlight.value ? (
            <span className={cn("shrink-0 text-[13px] font-semibold numeric", color)}>
              {highlight.value}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-pretty text-[12.5px] leading-5 text-secondary-foreground xl:text-[13.5px]">
          {highlight.detail}
        </span>
      </span>
      {isActionable ? (
        <ArrowRight
          size={14}
          aria-hidden
          className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/highlight:opacity-100 motion-reduce:transition-none"
        />
      ) : null}
    </>
  );

  const shell = cn(
    "group/highlight flex w-full gap-3 rounded-xl border bg-card px-4 py-3.5 text-left",
    border,
  );

  if (isActionable && submissionId) {
    return (
      <button
        type="button"
        onClick={() => onOpenSubmission?.(submissionId)}
        className={cn(
          shell,
          "outline-none transition-colors duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
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
