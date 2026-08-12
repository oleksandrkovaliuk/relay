import { Clock04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConvex } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

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
import { LessonTimeline } from "./lesson-timeline";

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

export function StudentHistoryPage({
  studentId,
  now,
  onBack,
}: {
  studentId: Id<"students">;
  now: number;
  onBack: () => void;
}) {
  const convex = useConvex();
  const history = useQuery(api.students.history, { studentId });
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<Id<"submissions"> | null>(null);
  const effectiveSubmissionId = selectedSubmissionId ?? history?.[0]?.submissionId ?? null;
  const detail = useQuery(
    api.submissions.detail,
    effectiveSubmissionId ? { submissionId: effectiveSubmissionId } : "skip",
  );

  useEffect(function keepSelectionInsideHistory() {
    if (!history || history.length === 0) {
      setSelectedSubmissionId(null);
      return;
    }
    const stillExists = history.some((entry) => entry.submissionId === selectedSubmissionId);
    const firstEntry = history[0];
    if (!stillExists && firstEntry) setSelectedSubmissionId(firstEntry.submissionId);
  }, [history, selectedSubmissionId]);

  const selectedEntry = history?.find((entry) => entry.submissionId === effectiveSubmissionId);

  function selectSubmission(submissionId: Id<"submissions">) {
    prewarmSubmissionDetail(convex, submissionId);
    setSelectedSubmissionId(submissionId);
  }

  return (
    <div className="mx-auto w-full max-w-[59rem] px-6 pb-12 pt-5 lg:px-8">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> Students
      </Button>

      {history && history.length > 1 ? (
        <NativeSelect
          aria-label="Selected lesson"
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

      <div className="mt-4 grid gap-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-0">
        <aside className="hidden sm:block">
          {/* The rail is centred in the viewport, not pinned under the header: it
              is the one control the page is scrubbed with, so it should sit where
              the hand already is, whatever the scroll position. */}
          <div className="sticky top-1/2 -ml-1 -translate-y-1/2">
            <LessonTimeline
              history={history}
              now={now}
              selectedSubmissionId={effectiveSubmissionId}
              onPrewarm={(submissionId) => prewarmSubmissionDetail(convex, submissionId)}
              onSelect={selectSubmission}
            />
          </div>
        </aside>

        <SelectedLesson detail={detail} hasEntry={Boolean(selectedEntry)} isLoading={!history} />
      </div>
    </div>
  );
}

function SelectedLesson({
  detail,
  hasEntry,
  isLoading,
}: {
  detail: Submission | null | undefined;
  hasEntry: boolean;
  isLoading: boolean;
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
  const measuredActiveMs = Math.max(
    detail.activeMs,
    detail.answers.reduce((total, answer) => total + answer.activeMs, 0),
  );
  const measuredLookupCount = Math.max(
    detail.lookupCount,
    detail.answers.reduce((total, answer) => total + answer.lookupCount, 0),
  );

  return (
    <article className="phase-enter min-w-0">
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
        </div>
        {detail.aiSummary?.text ? (
          <p className="mt-5 max-w-2xl text-pretty text-[13px] leading-6 text-secondary-foreground">
            {detail.aiSummary.text}
          </p>
        ) : null}
      </header>

      <section className="pt-6" aria-labelledby="lesson-steps-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h3
            id="lesson-steps-heading"
            className="text-[13px] font-semibold text-foreground"
          >
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
                index={index}
                isLast={index === detail.answers.length - 1}
                isSubmissionComplete={detail.status === "submitted"}
              />
            ))}
          </ol>
        )}
      </section>
    </article>
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
  index,
  isLast,
  isSubmissionComplete,
}: {
  answer: SubmissionAnswer;
  index: number;
  isLast: boolean;
  isSubmissionComplete: boolean;
}) {
  const answerState = getAnswerState(answer, isSubmissionComplete);
  const status = getAnswerStatus(answerState);
  const shouldShowExpectedAnswer =
    answer.answered &&
    Boolean(answer.correctAnswer) &&
    (answerState === "incorrect" || answerState === "partial" || answerState === "pending_review");
  const response = answer.response ?? emptyResponse(answer.publicContent);

  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 sm:gap-4">
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
      label: "Needs review",
      textClassName: "text-primary",
      circleClassName: "ring-primary/30 text-primary",
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
