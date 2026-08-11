import { useMutation, useQuery } from "convex/react";
import { Check, Clock3, Eye, Pencil, Star, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatDuration, humanizeIdentifier } from "@/lib/utils";

const CORRECTNESS_LABELS = {
  correct: "correct",
  partial: "partly right",
  incorrect: "incorrect",
  pending_review: "needs review",
  in_progress: "in progress",
  not_answered: "not answered",
} as const;

const GRADE_OPTIONS = [
  { value: "correct", label: "Correct" },
  { value: "partial", label: "Partly right" },
  { value: "incorrect", label: "Incorrect" },
] as const;

type TeacherGradeCorrectness = (typeof GRADE_OPTIONS)[number]["value"];

export function SubmissionDetail({
  submissionId,
  onClose,
}: {
  submissionId: Id<"submissions">;
  onClose: () => void;
}) {
  const detail = useQuery(api.submissions.detail, { submissionId });
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setIsOpen(false);
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        // The Sheet's own right-side defaults are three-quarter width; a review
        // pane wants a fixed reading column instead.
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[41rem]"
      >
        <SheetHeader className="shrink-0 flex-row items-start gap-4 border-b border-border/70 p-5 text-left sm:p-6">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-[17px] font-semibold tracking-[-0.02em]">
              {detail?.studentName ?? "Submission"}
            </SheetTitle>
            <SheetDescription className="mt-1 truncate text-[13px]">
              {detail?.assignmentTitle ?? "Loading submission details…"}
            </SheetDescription>
          </div>
          <SheetClose
            render={
              <Button variant="ghost" size="icon-lg" aria-label="Close submission review" />
            }
          >
            <X size={17} strokeWidth={2} aria-hidden />
          </SheetClose>
        </SheetHeader>

        {detail === undefined ? (
          <p
            className="flex items-center gap-2 px-5 py-8 text-sm text-secondary-foreground sm:px-6"
            aria-live="polite"
          >
            <Spinner /> Loading submission…
          </p>
        ) : detail === null ? (
          <p className="px-5 py-8 text-sm text-secondary-foreground sm:px-6">
            This submission is gone.
          </p>
        ) : (
          <ScrollArea
            className="min-h-0 flex-1"
            viewportProps={{ "aria-label": "Submission review" }}
          >
            <SubmissionContents detail={detail} />
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

type Submission = NonNullable<
  ReturnType<typeof useQuery<typeof api.submissions.detail>>
>;
type AnswerDetail = Submission["answers"][number];

function SubmissionContents({ detail }: { detail: Submission }) {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const pendingReviewCount = detail.answers.filter(
    (answer) => answer.correctness === "pending_review",
  ).length;
  const scorePercentage =
    detail.maxAutoScore === 0
      ? 0
      : Math.round(((detail.score ?? 0) / detail.maxAutoScore) * 100);
  const reviewStatus = getReviewStatus(detail.status, pendingReviewCount);

  return (
    <div className="grid gap-8 px-5 py-6 sm:px-7 sm:py-8">
      <section aria-labelledby="submission-overview-heading">
        <SectionHeading id="submission-overview-heading" title="Overview" />
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/45">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[12px] font-medium text-foreground/55">
                Current score
              </p>
              <p className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.045em] text-foreground numeric sm:text-[40px]">
                {scorePercentage}%
              </p>
            </div>
            <p className="pb-1 text-[13px] font-medium text-foreground/62 numeric sm:text-sm">
              {detail.score ?? 0} of {detail.maxAutoScore} graded points
            </p>
          </div>
          <dl className="divide-y divide-border/75 border-t border-border/75">
            <SummaryRow
              label="Active time"
              value={formatDuration(detail.activeMs)}
              icon={<Clock3 size={15} />}
            />
            <SummaryRow
              label="Answer lookups"
              value={String(detail.lookupCount)}
              icon={<Eye size={15} />}
            />
            <SummaryRow
              label="Review status"
              value={reviewStatus}
              tone={
                pendingReviewCount > 0
                  ? "accent"
                  : detail.status === "submitted"
                    ? "positive"
                    : "neutral"
              }
            />
          </dl>
        </div>
      </section>

      {detail.feedback ? (
        <section aria-labelledby="student-feedback-heading">
          <SectionHeading
            id="student-feedback-heading"
            title="Student feedback"
          />
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/45">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <p className="text-[13px] font-medium text-foreground sm:text-sm">
                How this homework felt
              </p>
              <RatingDisplay rating={detail.feedback.rating} />
            </div>
            {detail.feedback.comment ? (
              <p className="border-t border-border/75 px-5 py-4 text-pretty text-sm leading-6 text-foreground/72 sm:px-6 sm:text-[15px]">
                “{detail.feedback.comment}”
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {detail.aiSummary ? (
        <section aria-labelledby="review-summary-heading">
          <SectionHeading id="review-summary-heading" title="Review summary" />
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/45">
            <div className="px-5 py-5 sm:px-6">
              <p
                className={cn(
                  "text-pretty text-sm leading-6 text-foreground/72 sm:text-[15px]",
                  !isSummaryExpanded && "line-clamp-5",
                )}
              >
                {detail.aiSummary.text}
              </p>
              {detail.aiSummary.text.length > 420 ? (
                <button
                  type="button"
                  className="mt-2 min-h-8 text-[13px] font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setIsSummaryExpanded((isOpen) => !isOpen)}
                >
                  {isSummaryExpanded ? "Show less" : "Read full summary"}
                </button>
              ) : null}
            </div>
            {detail.aiSummary.focusAreas.length > 0 ? (
              <div className="border-t border-border/75 px-5 py-4 text-[13px] leading-5 text-foreground/65 sm:px-6 sm:text-sm">
                <span className="font-semibold text-foreground">
                  Focus next:{" "}
                </span>
                {detail.aiSummary.focusAreas.map(humanizeIdentifier).join(", ")}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="submission-answers-heading" className="pb-2">
        <SectionHeading
          id="submission-answers-heading"
          title="Answers"
          trailing={`${detail.answers.length} total`}
        />
        <div className="mt-3 grid gap-4">
          {detail.answers.map((answer) => (
            <AnswerReviewCard
              key={answer.questionId}
              answer={answer}
              isSubmissionComplete={detail.status === "submitted"}
              submissionId={detail._id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  id,
  title,
  trailing,
}: {
  id: string;
  title: string;
  trailing?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-0.5">
      <h2
        id={id}
        className="text-[14px] font-semibold tracking-[-0.01em] text-foreground sm:text-[15px]"
      >
        {title}
      </h2>
      {trailing ? (
        <span className="text-[12px] text-foreground/50 numeric sm:text-[13px]">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "positive";
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-3 text-[13px] sm:px-6 sm:text-sm">
      <dt className="flex items-center gap-2 text-foreground/60">
        {icon ? (
          <span aria-hidden className="text-foreground/45">
            {icon}
          </span>
        ) : null}
        {label}
      </dt>
      <dd
        className={cn(
          "text-right font-medium text-foreground numeric",
          tone === "accent" && "text-primary",
          tone === "positive" && "text-good",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function getReviewStatus(
  status: Submission["status"],
  pendingReviewCount: number,
) {
  if (pendingReviewCount > 0) {
    return `${pendingReviewCount} ${pendingReviewCount === 1 ? "answer" : "answers"} to grade`;
  }
  if (status === "submitted") return "Complete";
  return "In progress";
}

function RatingDisplay({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={15}
          aria-hidden
          className={cn(
            "text-ink-faint",
            index < rating && "fill-amber-400 text-amber-500",
          )}
        />
      ))}
      <span className="ml-1 text-[12px] font-medium text-foreground/58 numeric sm:text-[13px]">
        {rating}/5
      </span>
    </span>
  );
}

function AnswerReviewCard({
  answer,
  isSubmissionComplete,
  submissionId,
}: {
  answer: AnswerDetail;
  isSubmissionComplete: boolean;
  submissionId: Id<"submissions">;
}) {
  const correctness = !answer.answered
    ? "not_answered"
    : (answer.correctness ??
      (isSubmissionComplete ? "pending_review" : "in_progress"));
  const isCorrect = correctness === "correct";
  const isMiss = correctness === "incorrect" || correctness === "partial";
  const isPendingReview =
    answer.answered &&
    isSubmissionComplete &&
    answer.correctness === "pending_review";
  const isSlow = answer.activeMs > 90_000;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-muted/45",
        isPendingReview && "bg-primary-soft/45 ring-primary/20",
      )}
    >
      <header className="flex items-start gap-3.5 px-5 py-5 sm:px-6">
        <AnswerStatusIcon correctness={correctness} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-pretty text-[15px] font-medium leading-6 text-foreground sm:text-base">
              {answer.prompt}
            </p>
            <span
              className={cn(
                "shrink-0 text-[12px] font-semibold capitalize sm:text-[13px]",
                isCorrect && "text-good",
                isMiss && "text-destructive",
                isPendingReview && "text-primary",
                !isCorrect &&
                  !isMiss &&
                  !isPendingReview &&
                  "text-foreground/55",
              )}
            >
              {CORRECTNESS_LABELS[correctness]}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-foreground/55 numeric sm:text-[13px]">
            {answer.pointsAwarded === undefined
              ? "Not graded"
              : `${answer.pointsAwarded} of ${answer.points} points`}
          </p>
        </div>
      </header>

      <div className="divide-y divide-border/75 border-t border-border/75">
        <AnswerRow label="Student answer">
          <p className="whitespace-pre-line text-pretty text-sm leading-6 text-foreground sm:text-[15px]">
            {answer.answered
              ? answer.responseText || "(blank)"
              : "Not answered"}
          </p>
        </AnswerRow>

        {(isMiss || isPendingReview) && answer.correctAnswer ? (
          <AnswerRow label="Expected answer">
            <p className="whitespace-pre-line text-pretty text-sm leading-6 text-foreground sm:text-[15px]">
              {answer.correctAnswer}
            </p>
          </AnswerRow>
        ) : null}

        <div className="px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-foreground/58 sm:text-[13px]">
            <span
              className={cn(
                "flex items-center gap-1.5 numeric",
                isSlow && "font-medium text-destructive",
              )}
            >
              <Clock3 size={13} aria-hidden /> {formatDuration(answer.activeMs)}{" "}
              active
            </span>
            {answer.lookupCount > 0 ? (
              <span className="flex items-center gap-1.5 numeric">
                <Eye size={13} aria-hidden /> {answer.lookupCount} lookups
              </span>
            ) : null}
            {answer.revisionCount > 0 ? (
              <span className="flex items-center gap-1.5 numeric">
                <Pencil size={13} aria-hidden /> {answer.revisionCount} edits
              </span>
            ) : null}
          </div>
          {answer.skillTags.length > 0 ? (
            <p className="mt-2 text-pretty text-[12px] leading-5 text-foreground/58 sm:text-[13px]">
              <span className="font-semibold text-foreground/75">Skills: </span>
              {answer.skillTags.map(humanizeIdentifier).join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      {isPendingReview ? (
        <GradeAnswerForm answer={answer} submissionId={submissionId} />
      ) : null}
    </article>
  );
}

function AnswerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[116px_minmax(0,1fr)] sm:gap-5 sm:px-6">
      <p className="text-[12px] font-medium text-foreground/55 sm:text-[13px]">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AnswerStatusIcon({
  correctness,
}: {
  correctness: keyof typeof CORRECTNESS_LABELS;
}) {
  const isCorrect = correctness === "correct";
  const isMiss = correctness === "incorrect" || correctness === "partial";

  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 grid size-6 shrink-0 place-items-center text-sm font-semibold",
        isCorrect
          ? "text-good"
          : isMiss
            ? "text-destructive"
            : "text-foreground/55",
      )}
    >
      {isCorrect ? (
        <Check size={17} strokeWidth={2.5} />
      ) : isMiss ? (
        <X size={17} strokeWidth={2.5} />
      ) : (
        "?"
      )}
    </span>
  );
}

function GradeAnswerForm({
  answer,
  submissionId,
}: {
  answer: AnswerDetail;
  submissionId: Id<"submissions">;
}) {
  const gradePendingAnswer = useMutation(api.submissions.gradePendingAnswer);
  const [correctness, setCorrectness] =
    useState<TeacherGradeCorrectness>("correct");
  const [pointsText, setPointsText] = useState(String(answer.points));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointsAwarded = Number(pointsText);
  const hasValidPoints =
    pointsText.trim().length > 0 &&
    Number.isInteger(pointsAwarded) &&
    pointsAwarded >= 0 &&
    pointsAwarded <= answer.points;
  const hasConsistentGrade =
    (correctness === "correct" && pointsAwarded === answer.points) ||
    (correctness === "incorrect" && pointsAwarded === 0) ||
    (correctness === "partial" &&
      pointsAwarded > 0 &&
      pointsAwarded < answer.points);
  const canSave = hasValidPoints && hasConsistentGrade && !isSaving;
  const pointsInputId = `grade-points-${answer.questionId}`;
  const pointsHintId = `${pointsInputId}-hint`;

  function selectCorrectness(nextCorrectness: TeacherGradeCorrectness) {
    setCorrectness(nextCorrectness);
    setError(null);
    if (nextCorrectness === "correct") {
      setPointsText(String(answer.points));
      return;
    }
    if (nextCorrectness === "incorrect") {
      setPointsText("0");
      return;
    }
    setPointsText(String(Math.max(1, Math.floor(answer.points / 2))));
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await gradePendingAnswer({
        submissionId,
        questionId: answer.questionId,
        correctness,
        pointsAwarded,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save this grade.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="border-t border-border/75 px-5 py-5 sm:px-6"
      onSubmit={(event) => void saveGrade(event)}
    >
      <fieldset>
        <legend className="text-[13px] font-semibold text-foreground sm:text-sm">
          Teacher grade
        </legend>
        <div
          className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/80 p-1"
          aria-label="Answer result"
        >
          {GRADE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={correctness === option.value ? "default" : "ghost"}
              className="min-w-0 px-2"
              aria-pressed={correctness === option.value}
              disabled={
                isSaving || (option.value === "partial" && answer.points < 2)
              }
              onClick={() => selectCorrectness(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5" htmlFor={pointsInputId}>
          <span className="text-[13px] font-medium text-foreground">
            Points
          </span>
          <input
            id={pointsInputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={answer.points}
            step={1}
            value={pointsText}
            disabled={correctness !== "partial" || isSaving}
            aria-describedby={pointsHintId}
            onChange={(event) => setPointsText(event.target.value)}
            className="h-8 w-20 rounded-2xl border border-transparent bg-input/50 px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:bg-muted disabled:text-secondary-foreground"
          />
        </label>
        <p
          id={pointsHintId}
          className="min-w-[12rem] flex-1 pb-1 text-[13px] leading-5 text-secondary-foreground"
        >
          out of {answer.points}. Adjust points only for a partly right answer.
        </p>
        <Button type="submit" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save grade"}
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
