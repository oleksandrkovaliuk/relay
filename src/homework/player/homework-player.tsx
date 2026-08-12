import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Send,
  Star,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { HomeworkGlyph } from "@/homework/homework-glyph";
import {
  emptyResponse,
  hasAnyAnswer,
  isAnswerComplete,
  type AnswerResponse,
  type PlayerQuestion,
} from "./answer-types";
import { Confetti, pickCelebrationEmoji } from "./confetti";
import { HomeworkReview, ReviewTotal } from "./homework-review";
import { HomeworkWizard, HomeworkWizardFrame } from "./homework-wizard";
import { splitLessonTitle, summaryForStudent } from "./lesson-copy";
import { ReferenceRules, type ReferenceRule } from "./reference-rules";
import { PromptContent } from "./prompt-content";
import { QuestionWidget } from "./question-widgets";
import {
  clearStoredPlayerProgress,
  createStoredPlayerProgress,
  PLAYER_STORAGE_VERSION,
  readStoredPlayerProgress,
  restoreQuestionState,
  writeStoredPlayerProgress,
  writeStoredPlayerResult,
  type PlayerResult,
  type PlayerSession,
  type StoredPlayerProgress,
} from "./player-progress";
import { useQuestionTelemetry, type QuestionTelemetry } from "./use-question-telemetry";

const EMPTY_TELEMETRY: QuestionTelemetry = { activeMs: 0, lookupCount: 0, revisionCount: 0 };
const RESULT_TRANSITION_EASING = "cubic-bezier(.4, 0, .2, 1)";
const RESULT_TRANSITION_DURATION_MILLISECONDS = 300;
const REDUCED_RESULT_TRANSITION_DURATION_MILLISECONDS = 150;
const MAXIMUM_FEEDBACK_LENGTH = 500;
/** Enough to know what the homework is about without becoming a wall of text. */
const INTRO_VISIBLE_OBJECTIVES = 3;

export function HomeworkPlayer({ shareToken }: { shareToken: string }) {
  return <HomeworkPlayerContent key={shareToken} shareToken={shareToken} />;
}

function HomeworkPlayerContent({ shareToken }: { shareToken: string }) {
  const assignment = useQuery(api.assignments.getPublic, { shareToken });
  const [storedProgress, setStoredProgress] = useState(() => readStoredPlayerProgress(shareToken));
  const [session, setSession] = useState<PlayerSession | null>(
    () => storedProgress?.session ?? null,
  );
  const [result, setResult] = useState<PlayerResult | null>(() => storedProgress?.result ?? null);
  const savedFeedback = useQuery(
    api.feedback.getMine,
    session && result
      ? { submissionId: session.submissionId, resumeToken: session.resumeToken }
      : "skip",
  );
  const saveFeedback = useMutation(api.feedback.save);

  useEffect(function keepSharedLinkTitleBranded() {
    if (!assignment) return;
    document.title = `${assignment.title} · Relay`;
    return () => {
      document.title = "Homework · Relay";
    };
  }, [assignment?.title]);

  function handleStarted(nextSession: PlayerSession) {
    const nextProgress = createStoredPlayerProgress(nextSession);
    writeStoredPlayerProgress(shareToken, nextProgress);
    setStoredProgress(nextProgress);
    setSession(nextSession);
  }

  function handleFinished(nextResult: PlayerResult) {
    writeStoredPlayerResult(shareToken, nextResult);
    setStoredProgress(readStoredPlayerProgress(shareToken));
    setResult(nextResult);
  }

  function restartHomework() {
    clearStoredPlayerProgress(shareToken);
    setStoredProgress(null);
    setSession(null);
    setResult(null);
  }

  if (assignment === undefined) {
    return (
      <HomeworkWizardFrame>
        <PlayerCard className="items-center justify-center py-16 text-center">
          <p className="flex items-center gap-2.5 text-sm text-ink-secondary">
            <Spinner /> Loading your homework…
          </p>
        </PlayerCard>
      </HomeworkWizardFrame>
    );
  }

  if (assignment === null || assignment.questions.length === 0) {
    return (
      <HomeworkWizardFrame>
        <PlayerCard>
          <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">
            This homework link isn’t available.
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-7 text-ink-secondary">
            It may have been closed by your teacher, or the link may be incomplete. Ask your
            teacher to send it again.
          </p>
        </PlayerCard>
      </HomeworkWizardFrame>
    );
  }

  if (result) {
    return (
      <HomeworkWizardFrame>
        <ResultPanel
          studentName={session?.studentName ?? ""}
          result={result}
          session={session}
          savedFeedback={savedFeedback ?? null}
          isFeedbackLoading={savedFeedback === undefined}
          onSubmitFeedback={async ({ rating, comment }) => {
            if (!session) throw new Error("This homework session is no longer available.");
            await saveFeedback({
              submissionId: session.submissionId,
              resumeToken: session.resumeToken,
              rating,
              ...(comment.trim() ? { comment } : {}),
            });
          }}
        />
      </HomeworkWizardFrame>
    );
  }

  if (!session) {
    return (
      <HomeworkWizardFrame>
        <IntroPanel
          shareToken={shareToken}
          title={assignment.title}
          summary={assignment.summary}
          estimatedMinutes={assignment.estimatedMinutes}
          dueAt={assignment.dueAt}
          questionCount={assignment.questions.length}
          learningObjectives={assignment.learningObjectives}
          referenceRules={assignment.referenceRules}
          knownStudentName={assignment.studentName}
          onStarted={handleStarted}
        />
      </HomeworkWizardFrame>
    );
  }

  return (
    <HomeworkWizardFrame>
      <QuestionRunner
        questions={assignment.questions}
        referenceRules={assignment.referenceRules}
        session={session}
        shareToken={shareToken}
        initialProgress={storedProgress}
        onFinished={handleFinished}
        onRestart={restartHomework}
      />
    </HomeworkWizardFrame>
  );
}

/** The same card shell the wizard uses, for panels that have no steps. */
function PlayerCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card px-5 py-9 sm:px-10 sm:py-12",
        "shadow-[0_1px_2px_oklch(0_0_0/.04),0_12px_32px_-12px_oklch(0_0_0/.12)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function IntroPanel({
  shareToken,
  title,
  summary,
  estimatedMinutes,
  dueAt,
  questionCount,
  learningObjectives,
  referenceRules,
  knownStudentName,
  onStarted,
}: {
  shareToken: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  dueAt?: number;
  questionCount: number;
  learningObjectives: string[];
  referenceRules: ReferenceRule[];
  knownStudentName: string | null;
  onStarted: (session: PlayerSession) => void;
}) {
  const start = useMutation(api.submissions.start);
  const [typedName, setTypedName] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [areObjectivesExpanded, setAreObjectivesExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setIsStarting(true);
    setError(null);
    const resumeToken = crypto.randomUUID();
    try {
      const started = await start({
        shareToken,
        resumeToken,
        ...(knownStudentName ? {} : { studentName: typedName }),
      });
      onStarted({
        submissionId: started.submissionId,
        resumeToken,
        studentName: started.studentName,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the homework.");
      setIsStarting(false);
    }
  }

  const canBegin = knownStudentName !== null || typedName.trim().length >= 2;
  const { topic, focus } = splitLessonTitle(title, knownStudentName);
  const lede = summaryForStudent(summary);
  const visibleObjectives = areObjectivesExpanded
    ? learningObjectives
    : learningObjectives.slice(0, INTRO_VISIBLE_OBJECTIVES);
  const hiddenObjectiveCount = learningObjectives.length - visibleObjectives.length;

  return (
    <PlayerCard className="items-center text-center">
      <HomeworkGlyph id={shareToken} size="lg" />

      <h1 className="mt-6 max-w-2xl text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[34px] lg:text-[38px]">
        {topic}
      </h1>
      {focus ? (
        <p className="mt-2.5 max-w-xl text-balance text-[15px] font-medium leading-6 text-ink-secondary sm:text-[17px] sm:leading-7">
          {focus}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
        <IntroFact>
          {questionCount} {questionCount === 1 ? "activity" : "activities"}
        </IntroFact>
        <IntroFact icon={<Clock3 size={13} aria-hidden />}>~{estimatedMinutes} min</IntroFact>
        {dueAt ? (
          <IntroFact icon={<CalendarDays size={13} aria-hidden />}>
            Due {formatDueDate(dueAt)}
          </IntroFact>
        ) : null}
      </div>

      {lede ? (
        <p className="mt-6 max-w-[34rem] text-pretty text-[14.5px] leading-7 text-ink-secondary sm:text-[15.5px]">
          {lede}
        </p>
      ) : null}

      {learningObjectives.length > 0 ? (
        <section className="mt-7 w-full max-w-[30rem] text-left">
          <h2 className="text-center text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-muted">
            What you’ll practise
          </h2>
          <ul className="mt-3 grid gap-1.5">
            {visibleObjectives.map((objective) => (
              <li
                key={objective}
                className="flex items-start gap-2.5 rounded-xl bg-muted/45 px-3.5 py-2.5 text-pretty text-[13.5px] leading-6 text-ink"
              >
                <Check size={14} className="mt-1 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">{objective}</span>
              </li>
            ))}
          </ul>
          {hiddenObjectiveCount > 0 ? (
            <button
              type="button"
              onClick={() => setAreObjectivesExpanded(true)}
              className="mx-auto mt-2 block min-h-9 text-[13px] font-medium text-ink-secondary underline underline-offset-4 transition-opacity duration-150 hover:opacity-70"
            >
              {hiddenObjectiveCount} more
            </button>
          ) : null}
        </section>
      ) : null}

      {referenceRules.length > 0 ? (
        <ReferenceRules className="mt-6 w-full max-w-[30rem] text-left" rules={referenceRules} />
      ) : null}

      <div className="mt-8 w-full max-w-sm">
        {knownStudentName ? null : (
          <label className="block text-left">
            <span className="mb-2 block text-[13px] font-medium text-ink">Your name</span>
            <Input
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              placeholder="Enter your name"
              className="h-11 rounded-xl text-[15px]"
            />
          </label>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          size="xl"
          className="mt-4 w-full"
          disabled={!canBegin || isStarting}
          onClick={() => void begin()}
        >
          {isStarting
            ? "Starting…"
            : knownStudentName
              ? `Start, ${knownStudentName.split(" ")[0]}`
              : "Start homework"}
          <ArrowRight size={16} aria-hidden />
        </Button>
      </div>
    </PlayerCard>
  );
}

/** One small fact about the set: count, length, due date. */
function IntroFact({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[12.5px] font-medium text-ink-secondary numeric">
      {icon}
      {children}
    </span>
  );
}

function formatDueDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(timestamp);
}

function QuestionRunner({
  questions,
  referenceRules,
  session,
  shareToken,
  initialProgress,
  onFinished,
  onRestart,
}: {
  questions: PlayerQuestion[];
  referenceRules: ReferenceRule[];
  session: PlayerSession;
  shareToken: string;
  initialProgress: StoredPlayerProgress | null;
  onFinished: (result: PlayerResult) => void;
  onRestart: () => void;
}) {
  const saveAnswer = useMutation(api.submissions.saveAnswer);
  const submit = useMutation(api.submissions.submit);
  const restoredQuestionState = restoreQuestionState(initialProgress, questions);
  const [index, setIndex] = useState(restoredQuestionState.index);
  const [responses, setResponses] = useState(restoredQuestionState.responses);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTelemetry = useRef(new Map<string, QuestionTelemetry>());
  const savedQuestions = useRef(new Set<string>());

  useLayoutEffect(function persistProgressForResume() {
    writeStoredPlayerProgress(shareToken, {
      version: PLAYER_STORAGE_VERSION,
      session,
      index,
      responses,
    });
  }, [index, responses, session, shareToken]);

  const question = questions[Math.min(index, questions.length - 1)] as PlayerQuestion;
  const { countRevision, readTelemetry } = useQuestionTelemetry(question._id);
  const response = responses[question._id] ?? emptyResponse(question.content);
  const isLastQuestion = index === questions.length - 1;
  const answeredSteps = questions.map((candidate) => {
    const saved = responses[candidate._id];
    return saved ? isAnswerComplete(saved) : false;
  });
  const unansweredSteps = answeredSteps.flatMap((isAnswered, stepIndex) =>
    isAnswered ? [] : [stepIndex + 1],
  );
  const isCurrentAnswerComplete = isAnswerComplete(response);

  function updateResponse(next: AnswerResponse) {
    countRevision();
    setResponses((current) => ({ ...current, [question._id]: next }));
  }

  function accumulateTelemetry(): QuestionTelemetry {
    const previous = savedTelemetry.current.get(question._id) ?? EMPTY_TELEMETRY;
    const current = readTelemetry();
    const total = {
      activeMs: previous.activeMs + current.activeMs,
      lookupCount: previous.lookupCount + current.lookupCount,
      revisionCount: previous.revisionCount + current.revisionCount,
    };
    savedTelemetry.current.set(question._id, total);
    return total;
  }

  /**
   * A skipped step has nothing to send, so it stays absent server-side and the
   * student can come back to it. Once something has been sent, later edits —
   * including clearing the answer — are always sent too.
   */
  async function persistCurrentAnswer() {
    if (!hasAnyAnswer(response) && !savedQuestions.current.has(question._id)) return;
    await saveAnswer({
      submissionId: session.submissionId,
      resumeToken: session.resumeToken,
      questionId: question._id as Id<"assignmentQuestions">,
      response,
      stats: accumulateTelemetry(),
    });
    savedQuestions.current.add(question._id);
  }

  async function goToStep(step: number) {
    const nextIndex = clampStep(step, questions.length) - 1;
    if (nextIndex === index) return;
    setIsSaving(true);
    setError(null);
    try {
      await persistCurrentAnswer();
      setIndex(nextIndex);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answer.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitHomework() {
    setIsSaving(true);
    setError(null);
    try {
      await persistCurrentAnswer();
      onFinished(
        await submit({
          submissionId: session.submissionId,
          resumeToken: session.resumeToken,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HomeworkWizard
      key={question._id}
      currentStep={index + 1}
      totalSteps={questions.length}
      /* The set is the student's bearing — which part of the worksheet this is —
         so it outranks the widget's own type name. */
      eyebrow={question.set?.title ?? question.type.replaceAll("_", " ")}
      /* No score while the student is working: points would turn every step into
         a running tally. They are shown once, with the reasons, at the end. */
      prompt={
        <PromptContent prompt={question.prompt} size="lg" className="mt-2.5" />
      }
      instructions={question.set?.task ?? question.instructions}
      answeredSteps={answeredSteps}
      onSelectStep={(step) => void goToStep(step)}
      supplement={
        <>
          {referenceRules.length > 0 ? (
            <ReferenceRules className="mt-7" rules={referenceRules} />
          ) : null}
          {isLastQuestion && unansweredSteps.length > 0 ? (
            <SkippedStepsNotice
              steps={unansweredSteps}
              isBusy={isSaving}
              onGoToStep={(step) => void goToStep(step)}
            />
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-destructive/25 bg-critical-soft px-4 py-3.5 text-sm text-destructive"
            >
              <p>{error}</p>
              <button
                type="button"
                className="mt-1 min-h-9 font-medium underline underline-offset-4 transition-opacity duration-150 hover:opacity-75"
                onClick={onRestart}
              >
                Start again with a fresh session
              </button>
            </div>
          ) : null}
        </>
      }
      back={
        <Button
          variant="ghost"
          size="xl"
          disabled={index === 0 || isSaving}
          onClick={() => void goToStep(index)}
        >
          <ArrowLeft size={16} aria-hidden /> Back
        </Button>
      }
      next={
        /* Nothing is forced: an unfinished step can be left for later, and the
           ones still open are listed again before the homework is handed in. */
        <Button
          size="xl"
          variant={!isLastQuestion && !isCurrentAnswerComplete ? "outline" : "default"}
          disabled={isSaving}
          onClick={() => void (isLastQuestion ? submitHomework() : goToStep(index + 2))}
        >
          {isSaving
            ? "Saving…"
            : isLastQuestion
              ? "Submit homework"
              : isCurrentAnswerComplete
                ? "Continue"
                : "Skip for now"}
          {isLastQuestion ? <Send size={15} aria-hidden /> : <ArrowRight size={16} aria-hidden />}
        </Button>
      }
    >
      <QuestionWidget content={question.content} response={response} onChange={updateResponse} />
    </HomeworkWizard>
  );
}

/** Last stop before handing in: every step left open, one tap away. */
function SkippedStepsNotice({
  steps,
  isBusy,
  onGoToStep,
}: {
  steps: number[];
  isBusy: boolean;
  onGoToStep: (step: number) => void;
}) {
  return (
    <div className="mt-7 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
      <p className="text-[13.5px] font-medium text-ink">
        {steps.length} {steps.length === 1 ? "activity is" : "activities are"} still unanswered.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-secondary">
        You can go back to them, or submit as it is.
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <li key={step}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onGoToStep(step)}
              className="min-h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-ink numeric outline-none transition-[background-color,border-color] duration-150 hover:border-input hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
            >
              Step {step}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function clampStep(step: number, totalSteps: number) {
  return Math.min(Math.max(1, step), Math.max(1, totalSteps));
}

function ResultPanel({
  studentName,
  result,
  session,
  savedFeedback,
  isFeedbackLoading,
  onSubmitFeedback,
}: {
  studentName: string;
  result: PlayerResult;
  session: PlayerSession | null;
  savedFeedback: { rating: number; comment?: string } | null;
  isFeedbackLoading: boolean;
  onSubmitFeedback: (feedback: { rating: number; comment: string }) => Promise<void>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [celebrationEmoji] = useState(pickCelebrationEmoji);
  const review = useQuery(
    api.submissions.review,
    session && isReviewOpen
      ? { submissionId: session.submissionId, resumeToken: session.resumeToken }
      : "skip",
  );

  useEffect(function animateResultOnArrival() {
    const panel = panelRef.current;
    if (!panel) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialKeyframe: Keyframe = prefersReducedMotion
      ? { opacity: 0.85, transform: "scale(.995)" }
      : { opacity: 0, transform: "scale(.98)" };
    const duration = prefersReducedMotion
      ? REDUCED_RESULT_TRANSITION_DURATION_MILLISECONDS
      : RESULT_TRANSITION_DURATION_MILLISECONDS;
    const animation = panel.animate(
      [initialKeyframe, { opacity: 1, transform: "scale(1)" }],
      { duration, easing: RESULT_TRANSITION_EASING, fill: "both" },
    );

    void animation.finished.then(() => animation.cancel()).catch(() => undefined);
    return () => animation.cancel();
  }, []);

  return (
    <div ref={panelRef}>
      <PlayerCard className="relative">
        {/* The burst is drawn over the card, not in it, so nothing shifts. */}
        <Confetti />
        <div className="relative text-center">
          <div
            className="mx-auto grid size-12 place-items-center text-[34px] leading-none"
            aria-hidden
          >
            {celebrationEmoji}
          </div>
          <h1 className="mt-4 text-balance text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
            Submitted{studentName ? `, ${studentName}` : ""}.
          </h1>
          <p className="mt-2 text-base text-ink-secondary">Your teacher can see your work now.</p>
          <p className="mt-8 text-[46px] font-semibold leading-none tracking-[-0.04em] text-ink numeric">
            {result.percentage}%
          </p>
          <p className="mt-2 text-sm text-ink-secondary numeric">
            {result.score} of {result.maxAutoScore} auto-graded points
          </p>
          {result.pendingReviewCount > 0 ? (
            <p className="mx-auto mt-5 max-w-lg text-pretty text-sm leading-6 text-ink-secondary sm:text-[15px]">
              {result.pendingReviewCount} written{" "}
              {result.pendingReviewCount === 1 ? "answer" : "answers"} will be reviewed by your
              teacher.
            </p>
          ) : null}
          {session ? (
            <Button
              size="xl"
              variant={isReviewOpen ? "ghost" : "outline"}
              className="mt-6"
              aria-expanded={isReviewOpen}
              onClick={() => setIsReviewOpen((wasOpen) => !wasOpen)}
            >
              {isReviewOpen ? "Hide my answers" : "Go through my answers"}
            </Button>
          ) : null}
        </div>

        {isReviewOpen ? (
          <div className="mt-9 border-t border-border/70 pt-8 text-left">
            {review === undefined ? (
              <p className="flex items-center gap-2.5 text-sm text-ink-secondary">
                <Spinner /> Marking your answers…
              </p>
            ) : review === null ? (
              <p className="text-sm text-ink-secondary">
                This submission is no longer available.
              </p>
            ) : (
              <>
                <HomeworkReview review={review} />
                <ReviewTotal
                  percentage={review.percentage}
                  score={review.score}
                  maxAutoScore={review.maxAutoScore}
                  pendingReviewCount={review.pendingReviewCount}
                />
              </>
            )}
          </div>
        ) : null}

        <HomeworkFeedbackPanel
          savedFeedback={savedFeedback}
          isLoading={isFeedbackLoading}
          onSubmit={onSubmitFeedback}
        />
      </PlayerCard>
    </div>
  );
}

function HomeworkFeedbackPanel({
  savedFeedback,
  isLoading,
  onSubmit,
}: {
  savedFeedback: { rating: number; comment?: string } | null;
  isLoading: boolean;
  onSubmit: (feedback: { rating: number; comment: string }) => Promise<void>;
}) {
  const [rating, setRating] = useState(savedFeedback?.rating ?? 0);
  const [comment, setComment] = useState(savedFeedback?.comment ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(function adoptSavedFeedback() {
    if (!savedFeedback) return;
    setRating(savedFeedback.rating);
    setComment(savedFeedback.comment ?? "");
    setHasSubmitted(true);
  }, [savedFeedback]);

  async function submitFeedback() {
    if (rating < 1) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ rating, comment });
      setHasSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-border/70 pt-8 text-left">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 className="text-balance text-lg font-semibold tracking-[-0.02em] text-ink">
          How was this homework?
        </h2>
        {hasSubmitted ? (
          <p className="text-[13px] font-medium text-primary">Saved for your teacher</p>
        ) : null}
      </div>
      <p className="mt-1 text-pretty text-sm leading-6 text-ink-secondary">
        A quick rating helps your teacher plan the next lesson.
      </p>

      <fieldset className="mt-4" disabled={isLoading || isSubmitting}>
        <legend className="sr-only">Rate this homework from one to five</legend>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
                className="grid size-10 place-items-center rounded-xl text-ink-muted outline-none transition-[color,background-color,transform] duration-150 hover:bg-muted hover:text-ink active:scale-[.96] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Star
                  size={19}
                  strokeWidth={1.8}
                  className={value <= rating ? "fill-amber-400 text-amber-500" : undefined}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-ink">
          Anything your teacher should know?
        </span>
        <Textarea
          value={comment}
          maxLength={MAXIMUM_FEEDBACK_LENGTH}
          disabled={isLoading || isSubmitting}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional note"
          className="mt-2 min-h-20 rounded-xl text-sm"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-[12px] text-ink-muted numeric">
          {comment.length} / {MAXIMUM_FEEDBACK_LENGTH}
        </p>
        <Button
          size="xl"
          disabled={rating < 1 || isLoading || isSubmitting}
          onClick={() => void submitFeedback()}
        >
          {isSubmitting ? "Saving…" : hasSubmitted ? "Update feedback" : "Send feedback"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
