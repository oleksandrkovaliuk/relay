import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ListChecks,
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
  groupQuestionsIntoSections,
  hasAnyAnswer,
  isAnswerComplete,
  type AnswerResponse,
  type PlayerQuestion,
  type QuestionSection,
  type WidgetMarking,
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
          sectionCount={groupQuestionsIntoSections(assignment.questions).length}
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
        isSelfCheckEnabled={assignment.selfCheckEnabled}
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
  sectionCount,
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
  sectionCount: number;
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
          {sectionCount} {sectionCount === 1 ? "section" : "sections"}
        </IntroFact>
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

/**
 * One section per screen, every activity in it answered in place. A worksheet
 * section is ten items of one kind now, and walking those as ten separate steps
 * hid the shape of the practice: the student could not see the sentences they
 * had already done, and there was nothing to check until the whole set was in.
 */
function QuestionRunner({
  questions,
  referenceRules,
  isSelfCheckEnabled,
  session,
  shareToken,
  initialProgress,
  onFinished,
  onRestart,
}: {
  questions: PlayerQuestion[];
  referenceRules: ReferenceRule[];
  isSelfCheckEnabled: boolean;
  session: PlayerSession;
  shareToken: string;
  initialProgress: StoredPlayerProgress | null;
  onFinished: (result: PlayerResult) => void;
  onRestart: () => void;
}) {
  const convex = useConvex();
  const saveSectionAnswers = useMutation(api.submissions.saveSectionAnswers);
  const submit = useMutation(api.submissions.submit);
  const sections = groupQuestionsIntoSections(questions);
  const restoredQuestionState = restoreQuestionState(initialProgress, questions);
  const [index, setIndex] = useState(() =>
    Math.min(restoredQuestionState.index, Math.max(0, sections.length - 1)),
  );
  const [responses, setResponses] = useState(restoredQuestionState.responses);
  const [checksBySection, setChecksBySection] = useState<Record<string, SectionCheck>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTelemetry = useRef(new Map<string, QuestionTelemetry>());
  const savedQuestions = useRef(new Set<string>());
  /** Edits per activity, so one busy item does not inflate its neighbours. */
  const revisionCounts = useRef(new Map<string, number>());
  /** How much of this section's measured time has already been written down. */
  const bankedForSection = useRef({ key: "", activeMs: 0, lookupCount: 0 });

  const section = sections[Math.min(index, sections.length - 1)] as QuestionSection<PlayerQuestion>;
  const { countRevision, readTelemetry } = useQuestionTelemetry(section.key);

  useLayoutEffect(function persistProgressForResume() {
    writeStoredPlayerProgress(shareToken, {
      version: PLAYER_STORAGE_VERSION,
      session,
      index,
      responses,
    });
  }, [index, responses, session, shareToken]);

  const isLastSection = index === sections.length - 1;
  const answeredSections = sections.map((candidate) =>
    candidate.questions.every((question) => {
      const saved = responses[question._id];
      return saved ? isAnswerComplete(saved, question.content) : false;
    }),
  );
  /** Answered activities in the section on screen, for its own progress line. */
  const answeredInSection = section.questions.filter((question) => {
    const saved = responses[question._id];
    return saved ? isAnswerComplete(saved, question.content) : false;
  }).length;
  const hasAnythingToCheck = section.questions.some((question) =>
    hasAnyAnswer(responseFor(question)),
  );
  const openSections = answeredSections.flatMap((isAnswered, sectionIndex) =>
    isAnswered ? [] : [sectionIndex + 1],
  );
  const isSectionComplete = answeredSections[index] ?? false;
  const isSectionCheckable = section.questions.some(
    (question) => question.content.kind !== "open_response",
  );
  const check = checksBySection[section.key];

  function responseFor(question: PlayerQuestion) {
    return responses[question._id] ?? emptyResponse(question.content);
  }

  function updateResponse(question: PlayerQuestion, next: AnswerResponse) {
    countRevision();
    revisionCounts.current.set(
      question._id,
      (revisionCounts.current.get(question._id) ?? 0) + 1,
    );
    setResponses((current) => ({ ...current, [question._id]: next }));
    // A reworked answer must lose the verdict it was given, or the student is
    // reading a mark that belongs to what they just replaced.
    setChecksBySection((current) => {
      const existing = current[section.key];
      if (!existing || !existing.items[question._id]) return current;
      const { [question._id]: _reworked, ...items } = existing.items;
      return { ...current, [section.key]: { ...existing, items, isStale: true } };
    });
  }

  /**
   * The section is what was measured — the student moved between its activities
   * freely — so its engaged time and tab-aways are shared out across the
   * activities that were actually answered, while edits stay where they happened.
   *
   * Only what has not been banked yet is shared out: a section is saved every
   * time it is checked as well as when it is left, and counting the same minute
   * once per check would make a carefully reworked section look like an hour.
   */
  function accumulateTelemetry(answeredQuestionIds: string[]): Map<string, QuestionTelemetry> {
    const measured = readTelemetry();
    if (bankedForSection.current.key !== section.key) {
      bankedForSection.current = { key: section.key, activeMs: 0, lookupCount: 0 };
    }
    const newActiveMs = Math.max(0, measured.activeMs - bankedForSection.current.activeMs);
    const newLookupCount = Math.max(
      0,
      measured.lookupCount - bankedForSection.current.lookupCount,
    );
    bankedForSection.current = {
      key: section.key,
      activeMs: measured.activeMs,
      lookupCount: measured.lookupCount,
    };

    const shareCount = Math.max(1, answeredQuestionIds.length);
    const totals = new Map<string, QuestionTelemetry>();
    answeredQuestionIds.forEach((questionId, position) => {
      const previous = savedTelemetry.current.get(questionId) ?? EMPTY_TELEMETRY;
      const remainder = position === 0 ? newActiveMs % shareCount : 0;
      const lookupRemainder = position === 0 ? newLookupCount % shareCount : 0;
      const total = {
        activeMs: previous.activeMs + Math.floor(newActiveMs / shareCount) + remainder,
        lookupCount:
          previous.lookupCount + Math.floor(newLookupCount / shareCount) + lookupRemainder,
        revisionCount: revisionCounts.current.get(questionId) ?? previous.revisionCount,
      };
      savedTelemetry.current.set(questionId, total);
      totals.set(questionId, total);
    });
    return totals;
  }

  /**
   * A skipped activity has nothing to send, so it stays absent server-side and
   * the student can come back to it. Once something has been sent, later edits —
   * including clearing the answer — are always sent too.
   */
  async function persistSectionAnswers() {
    const pending = section.questions.filter(
      (question) =>
        hasAnyAnswer(responseFor(question)) || savedQuestions.current.has(question._id),
    );
    if (pending.length === 0) return;
    const telemetry = accumulateTelemetry(pending.map((question) => question._id));
    // One transaction for the section: either the screen is saved or it is not.
    await saveSectionAnswers({
      submissionId: session.submissionId,
      resumeToken: session.resumeToken,
      answers: pending.map((question) => ({
        questionId: question._id as Id<"assignmentQuestions">,
        response: responseFor(question),
        stats: telemetry.get(question._id) ?? EMPTY_TELEMETRY,
      })),
    });
    for (const question of pending) savedQuestions.current.add(question._id);
  }

  async function goToSection(step: number) {
    const nextIndex = clampStep(step, sections.length) - 1;
    if (nextIndex === index) return;
    setIsSaving(true);
    setError(null);
    try {
      await persistSectionAnswers();
      setIndex(nextIndex);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answer.");
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Marks this section without submitting anything: the server grades what has
   * been saved and returns verdicts only, so the student can see which of their
   * own answers are wrong and rework them before moving on.
   */
  async function checkSection() {
    setIsChecking(true);
    setError(null);
    try {
      await persistSectionAnswers();
      const result = await convex.query(api.submissions.checkSection, {
        submissionId: session.submissionId,
        resumeToken: session.resumeToken,
        questionIds: section.questions.map((question) => question._id as Id<"assignmentQuestions">),
      });
      if (!result) throw new Error("This homework session is no longer available.");
      setChecksBySection((current) => ({
        ...current,
        [section.key]: {
          score: result.score,
          maxScore: result.maxScore,
          correctCount: result.correctCount,
          gradedCount: result.gradedCount,
          isStale: false,
          items: Object.fromEntries(
            result.items.map((item) => [
              item.questionId,
              { status: item.status, parts: item.parts },
            ]),
          ),
        },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check this section.");
    } finally {
      setIsChecking(false);
    }
  }

  async function submitHomework() {
    setIsSaving(true);
    setError(null);
    try {
      await persistSectionAnswers();
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

  const isBusy = isSaving || isChecking;

  return (
    <HomeworkWizard
      key={section.key}
      currentStep={index + 1}
      totalSteps={sections.length}
      stepNoun="Section"
      /* A ten-activity screen needs its own progress: the rail counts sections,
         and inside one there was nothing saying how far through it you were. */
      eyebrow={`${answeredInSection} of ${section.questions.length} answered`}
      /* No score while the student is working: points would turn every section
         into a running tally. They are shown once, with the reasons, at the end. */
      prompt={<PromptContent prompt={section.title} size="lg" className="mt-2.5" />}
      instructions={section.task}
      answeredSteps={answeredSections}
      onSelectStep={(step) => void goToSection(step)}
      /* The cheat sheet belongs where the student lands, above the work. */
      aside={referenceRules.length > 0 ? <ReferenceRules rules={referenceRules} /> : null}
      supplement={
        <>
          {check ? <SectionCheckSummary check={check} /> : null}
          {isLastSection && openSections.length > 0 ? (
            <SkippedSectionsNotice
              sections={openSections}
              isBusy={isBusy}
              onGoToSection={(step) => void goToSection(step)}
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
          disabled={index === 0 || isBusy}
          onClick={() => void goToSection(index)}
        >
          <ArrowLeft size={16} aria-hidden /> Back
        </Button>
      }
      next={
        <>
          {/* A section of written answers has nothing a machine can mark, so
              offering to check it only promises something it cannot give. */}
          {isSelfCheckEnabled && isSectionCheckable ? (
            <Button
              variant="outline"
              size="xl"
              disabled={isBusy || !hasAnythingToCheck}
              title={
                hasAnythingToCheck ? undefined : "Answer something first, then check it."
              }
              onClick={() => void checkSection()}
            >
              <ListChecks size={16} aria-hidden />
              {isChecking ? "Checking…" : check && !check.isStale ? "Check again" : "Check section"}
            </Button>
          ) : null}
          {/* Nothing is forced: an unfinished section can be left for later, and
              the ones still open are listed again before the homework is in. */}
          <Button
            size="xl"
            variant={!isLastSection && !isSectionComplete ? "outline" : "default"}
            disabled={isBusy}
            onClick={() => void (isLastSection ? submitHomework() : goToSection(index + 2))}
          >
            {isSaving
              ? "Saving…"
              : isLastSection
                ? "Submit homework"
                : isSectionComplete
                  ? "Continue"
                  : "Skip for now"}
            {isLastSection ? <Send size={15} aria-hidden /> : <ArrowRight size={16} aria-hidden />}
          </Button>
        </>
      }
    >
      <ol className="grid gap-7">
        {section.questions.map((question, questionIndex) => (
          <SectionActivity
            key={question._id}
            question={question}
            number={questionIndex + 1}
            sectionTask={section.task}
            response={responseFor(question)}
            verdict={check?.items[question._id]}
            onChange={(next) => updateResponse(question, next)}
          />
        ))}
      </ol>
    </HomeworkWizard>
  );
}

type SectionItemVerdict = {
  status: "correct" | "partial" | "incorrect" | "needs_teacher" | "unanswered";
  parts: boolean[];
};

type SectionCheck = {
  score: number;
  maxScore: number;
  correctCount: number;
  gradedCount: number;
  /** Set once an answer in the section was reworked after it was marked. */
  isStale: boolean;
  items: Record<string, SectionItemVerdict>;
};

const VERDICT_CHIP_LABELS: Record<SectionItemVerdict["status"], string> = {
  correct: "correct",
  partial: "nearly",
  incorrect: "try again",
  needs_teacher: "your teacher will read this",
  unanswered: "not answered",
};

/** One activity inside a section: its own prompt, its own answer, its own mark. */
function SectionActivity({
  question,
  number,
  sectionTask,
  response,
  verdict,
  onChange,
}: {
  question: PlayerQuestion;
  number: number;
  sectionTask: string;
  response: AnswerResponse;
  verdict?: SectionItemVerdict;
  onChange: (response: AnswerResponse) => void;
}) {
  const isMarked = verdict?.status === "correct" || verdict?.status === "partial" || verdict?.status === "incorrect";

  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
      <span className="mt-0.5 font-mono text-[12.5px] text-ink-muted numeric">{number}.</span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <PromptContent prompt={question.prompt} size="sm" className="min-w-0 flex-1" />
          {verdict ? (
            <span
              className={cn(
                "mt-0.5 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em]",
                verdict.status === "correct"
                  ? "text-primary"
                  : verdict.status === "incorrect" || verdict.status === "partial"
                    ? "text-destructive"
                    : "text-ink-muted",
              )}
            >
              {VERDICT_CHIP_LABELS[verdict.status]}
            </span>
          ) : null}
        </div>
        {question.instructions && question.instructions !== sectionTask ? (
          <p className="mt-1 text-pretty text-[12.5px] leading-5 text-ink-muted">
            {question.instructions}
          </p>
        ) : null}
        <div className="mt-3">
          <QuestionWidget
            content={question.content}
            response={response}
            onChange={onChange}
            marking={isMarked ? toCheckMarking(verdict) : undefined}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * What a mid-homework check may say: this part of your answer is wrong. Never
 * what the answer was — the student is about to rework it, and the full key with
 * its explanations is waiting at the end.
 */
function toCheckMarking(verdict: SectionItemVerdict): WidgetMarking {
  return {
    parts: verdict.parts.map((isCorrect) => ({ isCorrect, expected: "" })),
    revealsAnswers: false,
    verdict: verdict.status === "needs_teacher" || verdict.status === "unanswered"
      ? "incorrect"
      : verdict.status,
  };
}

function SectionCheckSummary({ check }: { check: SectionCheck }) {
  if (check.gradedCount === 0) {
    return (
      <p className="mt-7 rounded-xl border border-border bg-muted/40 px-4 py-3.5 text-[13px] leading-5 text-ink-secondary">
        These answers are written in your own words, so your teacher reads them.
      </p>
    );
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border px-4 py-3.5",
        // A green panel over "0 / 6 right" reads as success at a glance, which
        // is the exact confusion this check exists to remove.
        check.isStale
          ? "border-border bg-muted/40"
          : check.correctCount === check.gradedCount
            ? "border-primary/40 bg-primary-soft/45"
            : "border-destructive/35 bg-critical-soft/40",
      )}
    >
      <p className="text-[15px] font-semibold text-ink numeric">
        {check.correctCount} / {check.gradedCount} right
      </p>
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-ink-secondary">
        {check.isStale
          ? "You changed an answer since this check — check again to mark it."
          : check.correctCount === check.gradedCount
            ? "All correct. Keep going."
            : "The ones marked in red are still wrong. Fix them and check again, or move on."}
      </p>
    </div>
  );
}

/** Last stop before handing in: every section left open, one tap away. */
function SkippedSectionsNotice({
  sections,
  isBusy,
  onGoToSection,
}: {
  sections: number[];
  isBusy: boolean;
  onGoToSection: (step: number) => void;
}) {
  return (
    <div className="mt-7 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
      <p className="text-[13.5px] font-medium text-ink">
        {sections.length} {sections.length === 1 ? "section is" : "sections are"} not finished.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-secondary">
        You can go back to them, or submit as it is.
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {sections.map((step) => (
          <li key={step}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onGoToSection(step)}
              className="min-h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-ink numeric outline-none transition-[background-color,border-color] duration-150 hover:border-input hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
            >
              Section {step}
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
