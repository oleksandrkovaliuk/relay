import { Clock04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConvex } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useRef } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { prewarmSubmissionDetail } from "@/lib/convex-query-warmup";
import { cn, formatDuration, humanizeIdentifier } from "@/lib/utils";
import { emptyResponse } from "@/homework/player/answer-types";
import { PromptContent } from "@/homework/player/prompt-content";
import { QuestionWidget } from "@/homework/player/question-widgets";
import { GradeAnswerForm } from "./grade-answer-form";
import { LessonPicker } from "./lesson-picker";

type Submission = NonNullable<ReturnType<typeof useQuery<typeof api.submissions.detail>>>;
type SubmissionAnswer = Submission["answers"][number];
type AnswerState =
  | NonNullable<SubmissionAnswer["correctness"]>
  | "answered"
  | "not_answered"
  | "not_graded";

const LESSON_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const ignoreReadOnlyChange = () => undefined;

/**
 * The one place homework gets reviewed, wherever the teacher came from: the
 * student's other sets down the left, the chosen one marked up on the right,
 * every answer shown inside the widget the student actually used. Grading a
 * written answer happens on the answer itself rather than in a form at the end.
 */
export function SubmissionReview({
  studentId,
  submissionId,
  focusStep,
  now,
  backLabel,
  onBack,
  onSelectSubmission,
}: {
  /** Known up front from the student route; resolved from the submission otherwise. */
  studentId: Id<"students"> | null;
  submissionId: Id<"submissions"> | null;
  /** 1-based activity to open on, for a link that points at one step. */
  focusStep: number | null;
  now: number;
  backLabel: string;
  onBack: () => void;
  onSelectSubmission: (submissionId: Id<"submissions">) => void;
}) {
  const convex = useConvex();
  const openDetail = useQuery(
    api.submissions.detail,
    submissionId ? { submissionId } : "skip",
  );
  /** A submission reached from Today may be the first thing we know about. */
  const effectiveStudentId = studentId ?? openDetail?.studentId ?? null;
  const history = useQuery(
    api.students.history,
    effectiveStudentId ? { studentId: effectiveStudentId } : "skip",
  );
  const fallbackSubmissionId = history?.[0]?.submissionId ?? null;
  const effectiveSubmissionId = submissionId ?? fallbackSubmissionId;
  const fallbackDetail = useQuery(
    api.submissions.detail,
    !submissionId && fallbackSubmissionId
      ? { submissionId: fallbackSubmissionId }
      : "skip",
  );
  const detail = submissionId ? openDetail : fallbackDetail;
  const isLoadingHistory = Boolean(effectiveStudentId) && history === undefined;
  const hasEntry = Boolean(effectiveSubmissionId);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(function startEachSetFromTheTop() {
    // Picking another set halfway down a long review would otherwise open the
    // new one at the old scroll position, mid-answer.
    const viewport = pageRef.current?.closest("[data-slot=scroll-area-viewport]");
    viewport?.scrollTo({ top: 0 });
  }, [effectiveSubmissionId]);

  function selectSubmission(nextSubmissionId: Id<"submissions">) {
    prewarmSubmissionDetail(convex, nextSubmissionId);
    onSelectSubmission(nextSubmissionId);
  }

  return (
    <div ref={pageRef} className="mx-auto w-full max-w-[74rem] px-6 pb-12 pt-5 lg:px-8">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> {backLabel}
      </Button>

      {history && history.length > 1 ? (
        <NativeSelect
          aria-label="Selected homework"
          className="mt-4 sm:hidden"
          value={effectiveSubmissionId ?? ""}
          onChange={(event) => selectSubmission(event.target.value as Id<"submissions">)}
        >
          {history.map((entry) => (
            <NativeSelectOption key={entry.submissionId} value={entry.submissionId}>
              {entry.assignmentTitle} ·{" "}
              {entry.status === "submitted" ? "Submitted" : "In progress"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}

      <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-8">
        <aside className="hidden sm:block">
          {/* Pinned below the page header, not to the top of the viewport: the
              header is sticky too, and anything level with it is hidden by it. */}
          <div className="sticky top-[calc(var(--page-header-height)+1rem)]">
            <p className="px-3 pb-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Homework sets
            </p>
            <LessonPicker
              history={history}
              now={now}
              selectedSubmissionId={effectiveSubmissionId}
              onPrewarm={(id) => prewarmSubmissionDetail(convex, id)}
              onSelect={selectSubmission}
            />
          </div>
        </aside>

        <SelectedLesson
          detail={detail}
          hasEntry={hasEntry}
          isLoading={isLoadingHistory}
          focusStep={focusStep}
        />
      </div>
    </div>
  );
}

function SelectedLesson({
  detail,
  hasEntry,
  isLoading,
  focusStep,
}: {
  detail: Submission | null | undefined;
  hasEntry: boolean;
  isLoading: boolean;
  focusStep: number | null;
}) {
  if (isLoading || detail === undefined) {
    if (!isLoading && !hasEntry) return <EmptyHistory />;
    return <LessonSkeleton />;
  }

  if (!hasEntry) return <EmptyHistory />;

  if (detail === null) {
    return (
      <p className="py-8 text-[13px] text-secondary-foreground">
        This lesson is no longer available.
      </p>
    );
  }

  const answeredCount = detail.answers.filter((answer) => answer.answered).length;
  const pendingAnswers = detail.answers.filter(
    (answer) => answer.answered && answer.correctness === "pending_review",
  );
  const measuredActiveMs = Math.max(
    detail.activeMs,
    detail.answers.reduce((total, answer) => total + answer.activeMs, 0),
  );
  const measuredLookupCount = Math.max(
    detail.lookupCount,
    detail.answers.reduce((total, answer) => total + answer.lookupCount, 0),
  );

  return (
    <article className="min-w-0">
      <header className="border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-medium">
          <span
            className={detail.status === "submitted" ? "text-primary" : "text-secondary-foreground"}
          >
            {detail.status === "submitted" ? "Submitted" : "In progress"}
          </span>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <time className="text-muted-foreground numeric">
            {LESSON_DATE_FORMATTER.format(detail.submittedAt ?? detail.startedAt)}
          </time>
        </div>
        <h2 className="mt-2 max-w-2xl text-balance text-[21px] font-semibold leading-7 tracking-[-0.035em] text-foreground sm:text-[24px] sm:leading-8">
          {detail.assignmentTitle}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-secondary-foreground">
          <span className="font-medium text-foreground numeric">
            {getLessonScoreLabel(detail, answeredCount)}
          </span>
          <span className="inline-flex items-center gap-1.5 numeric">
            <HugeiconsIcon icon={Clock04Icon} size={13} strokeWidth={2} aria-hidden />
            {formatDuration(measuredActiveMs)} active
          </span>
          {measuredLookupCount > 0 ? (
            <span className="numeric">{measuredLookupCount} lookups</span>
          ) : null}
          {detail.feedback ? <FeedbackRating rating={detail.feedback.rating} /> : null}
        </div>

        {/* What the teacher is here to do, said before the reading starts. */}
        {pendingAnswers.length > 0 ? (
          <p className="mt-4 rounded-xl border border-primary/25 bg-primary-soft/50 px-3.5 py-2.5 text-[12.5px] leading-5 text-foreground">
            <span className="font-semibold">
              {pendingAnswers.length} written{" "}
              {pendingAnswers.length === 1 ? "answer needs" : "answers need"} your grade.
            </span>{" "}
            The student&rsquo;s score stays incomplete until you decide. They are marked below.
          </p>
        ) : null}

        {detail.aiSummary?.text ? (
          <p className="mt-5 max-w-2xl text-pretty text-[13px] leading-6 text-secondary-foreground">
            {detail.aiSummary.text}
          </p>
        ) : null}
        {detail.feedback?.comment ? (
          <p className="mt-3 max-w-2xl text-pretty text-[12.5px] leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">The student said:</span> &ldquo;
            {detail.feedback.comment}&rdquo;
          </p>
        ) : null}
      </header>

      <section className="pt-6" aria-labelledby="lesson-steps-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="lesson-steps-heading" className="text-[13px] font-semibold text-foreground">
            Lesson steps
          </h3>
          <span className="text-[12px] text-muted-foreground numeric">
            {answeredCount} of {detail.answers.length} answered
          </span>
        </div>

        {detail.answers.length === 0 ? (
          <p className="mt-4 rounded-xl bg-muted/55 px-4 py-4 text-[13px] text-secondary-foreground">
            No lesson steps are available.
          </p>
        ) : (
          <ol className="mt-5">
            {detail.answers.map((answer, index) => (
              <LessonStep
                key={answer.questionId}
                answer={answer}
                submissionId={detail._id}
                index={index}
                isLast={index === detail.answers.length - 1}
                isSubmissionComplete={detail.status === "submitted"}
                isFocused={focusStep === index + 1}
              />
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

function FeedbackRating({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`The student rated this ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={12}
          aria-hidden
          className={cn("text-ink-faint", index < rating && "fill-amber-400 text-amber-500")}
        />
      ))}
    </span>
  );
}

function EmptyHistory() {
  return (
    <p className="py-10 text-[13px] text-secondary-foreground">
      No lessons yet. They appear here as soon as this student starts homework.
    </p>
  );
}

function LessonSkeleton() {
  return (
    <div className="min-w-0" aria-hidden>
      <div className="border-b border-border/70 pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-2 h-6 w-1/2" />
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="pt-6">
        <Skeleton className="h-3 w-24" />
        {["first", "second"].map((key) => (
          <div key={key} className="mt-6 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-4">
            <Skeleton className="size-5 rounded-full" />
            <div className="min-w-0">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-3 h-5 w-2/3" />
              <div className="mt-5 grid gap-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading lesson</span>
    </div>
  );
}

function LessonStep({
  answer,
  submissionId,
  index,
  isLast,
  isSubmissionComplete,
  isFocused,
}: {
  answer: SubmissionAnswer;
  submissionId: Id<"submissions">;
  index: number;
  isLast: boolean;
  isSubmissionComplete: boolean;
  /** The step a link pointed at — the one the student stopped on. */
  isFocused: boolean;
}) {
  const stepRef = useRef<HTMLLIElement>(null);
  const answerState = getAnswerState(answer, isSubmissionComplete);
  const status = getAnswerStatus(answerState);
  const isPendingReview = answerState === "pending_review";
  const shouldShowExpectedAnswer =
    answer.answered &&
    Boolean(answer.correctAnswer) &&
    (answerState === "incorrect" || answerState === "partial" || isPendingReview);
  const response = answer.response ?? emptyResponse(answer.publicContent);

  useEffect(function revealTheLinkedStep() {
    if (!isFocused) return;
    stepRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isFocused]);

  return (
    <li
      ref={stepRef}
      aria-current={isFocused ? "step" : undefined}
      className={cn(
        "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 sm:gap-4",
        isFocused && "-mx-3 rounded-2xl bg-primary-soft/35 px-3 pt-3",
      )}
    >
      <div className="relative">
        <span
          className={cn(
            "relative z-[1] grid size-5 place-items-center rounded-full bg-background text-[10px] font-semibold ring-1 numeric",
            status.circleClassName,
          )}
        >
          {index + 1}
        </span>
        {!isLast ? (
          <span
            aria-hidden
            className="absolute bottom-0 left-[10px] top-5 w-px -translate-x-1/2 bg-border/80"
          />
        ) : null}
      </div>

      <article className={cn("min-w-0", isLast ? "pb-2" : "pb-9")}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {humanizeIdentifier(answer.type)}
          </p>
          <span className={cn("shrink-0 text-[12px] font-semibold", status.textClassName)}>
            {status.label}
          </span>
        </div>

        <PromptContent
          prompt={answer.prompt}
          size="sm"
          headingLevel={4}
          className="mt-1.5 max-w-2xl"
        />
        <p className="mt-1.5 max-w-2xl text-pretty text-[12.5px] leading-5 text-muted-foreground">
          {answer.instructions}
        </p>

        <div
          className="mt-4 max-w-2xl"
          aria-label={answer.answered ? "Submitted answer" : "No submitted answer"}
        >
          <QuestionWidget
            content={answer.publicContent}
            response={response}
            onChange={ignoreReadOnlyChange}
            isReadOnly
          />
        </div>

        {!answer.answered ? (
          <p className="mt-2.5 text-[12px] text-muted-foreground">No answer was submitted.</p>
        ) : null}

        {shouldShowExpectedAnswer ? (
          <p className="mt-3 max-w-2xl text-pretty text-[12.5px] leading-5 text-secondary-foreground">
            <span className="font-semibold text-foreground">Teacher key:</span>{" "}
            <span className="whitespace-pre-line">{answer.correctAnswer}</span>
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className="font-medium text-secondary-foreground numeric">
            {getPointsLabel(answer)}
          </span>
          {answer.answered ? (
            <>
              <span className="numeric">{formatDuration(answer.activeMs)} active</span>
              {answer.lookupCount > 0 ? (
                <span className="numeric">{answer.lookupCount} lookups</span>
              ) : null}
              {answer.revisionCount > 0 ? (
                <span className="numeric">{answer.revisionCount} edits</span>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Last, so the decision comes after everything it should be based on. */}
        {isPendingReview ? (
          <GradeAnswerForm answer={answer} submissionId={submissionId} />
        ) : null}
      </article>
    </li>
  );
}

function getLessonScoreLabel(detail: Submission, answeredCount: number) {
  if (detail.status !== "submitted") {
    return `${answeredCount} of ${detail.answers.length} answered`;
  }
  if (detail.score === undefined) return "Grading pending";
  return `${detail.score} / ${detail.maxAutoScore} points`;
}

function getAnswerState(answer: SubmissionAnswer, isSubmissionComplete: boolean): AnswerState {
  if (!answer.answered) return "not_answered";
  if (answer.correctness) return answer.correctness;
  if (isSubmissionComplete) return "not_graded";
  return "answered";
}

function getPointsLabel(answer: SubmissionAnswer) {
  const hasFinalGrade =
    answer.answered &&
    answer.pointsAwarded !== undefined &&
    answer.correctness !== undefined &&
    answer.correctness !== "pending_review";
  if (!hasFinalGrade) return "Not graded";
  return `${answer.pointsAwarded} / ${answer.points} points`;
}

function getAnswerStatus(answerState: AnswerState) {
  if (answerState === "correct") {
    return {
      label: "Correct",
      textClassName: "text-primary",
      circleClassName: "ring-primary/30 text-primary",
    };
  }
  if (answerState === "incorrect") {
    return {
      label: "Incorrect",
      textClassName: "text-destructive",
      circleClassName: "ring-destructive/25 text-destructive",
    };
  }
  if (answerState === "partial") {
    return {
      label: "Partly right",
      textClassName: "text-primary",
      circleClassName: "ring-primary/30 text-primary",
    };
  }
  if (answerState === "pending_review") {
    return {
      label: "Needs your grade",
      textClassName: "text-primary",
      circleClassName: "ring-primary/50 bg-primary-soft text-primary",
    };
  }
  if (answerState === "not_answered") {
    return {
      label: "Not answered",
      textClassName: "text-muted-foreground",
      circleClassName: "ring-border text-muted-foreground",
    };
  }
  if (answerState === "not_graded") {
    return {
      label: "Not graded",
      textClassName: "text-secondary-foreground",
      circleClassName: "ring-border text-secondary-foreground",
    };
  }
  return {
    label: "Answered",
    textClassName: "text-primary",
    circleClassName: "ring-primary/30 text-primary",
  };
}
