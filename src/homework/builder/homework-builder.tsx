import { useQuery } from "convex-helpers/react/cache";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useGenerationRuns } from "@/claude/generation-runs";
import { PageHeader } from "@/app/workspace-shell";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentMultiPicker } from "@/homework/assignment/student-multi-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES,
  MAXIMUM_ACTIVITY_ITEM_COUNT,
  MAXIMUM_PLANNED_ITEMS,
  MINIMUM_ACTIVITY_ITEM_COUNT,
  type ActivityPlanEntry,
  type ActivityType,
  type ClaudeAvailability,
} from "@/shared/claude";

import { ActivityTypePicker } from "./activity-type-picker";
import { BuilderPreview } from "./builder-preview";

type Difficulty = "beginner" | "intermediate" | "advanced";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type BuilderBriefSnapshot = {
  studentIds: Id<"students">[];
  lessonNotes: string;
  targetSkills: string;
  difficulty: Difficulty;
  /** Take the newest activity on the student's board as the lesson brief. */
  useMiroBrief: boolean;
  activityPlan: ActivityPlanEntry[];
};

/** Bumped with the shape: a v1 brief has minutes where the plan now lives. */
const BUILDER_STORAGE_KEY = "erm:homework-builder-brief:v2";
const MAXIMUM_LESSON_NOTES_LENGTH = 100_000;
const RECENT_RESULT_COUNT = 3;
const MAXIMUM_FOCUS_AREAS = 5;

export function HomeworkBuilder({
  availability,
  initialStudentId,
  onOpenClaudeSetup,
  onGenerationStarted,
  startFresh = false,
}: {
  availability: ClaudeAvailability | null;
  initialStudentId: Id<"students"> | null;
  onOpenClaudeSetup?: () => void;
  /** Called once the run is recorded — the builder's job is done at that point. */
  onGenerationStarted: () => void;
  startFresh?: boolean;
}) {
  const students = useQuery(api.students.list);
  const { start: startGeneration } = useGenerationRuns();

  const [initialSnapshot] = useState(() =>
    startFresh ? createEmptyBuilderSnapshot() : readBuilderSnapshot(),
  );
  const [studentIds, setStudentIds] = useState<Id<"students">[]>(
    initialStudentId ? [initialStudentId] : initialSnapshot.studentIds,
  );
  /**
   * Personal context only applies when the homework is for one learner. With
   * several assignees the set has to stand on its own, so nobody's errors — or
   * name — end up written into it.
   */
  const studentId = studentIds.length === 1 ? (studentIds[0] ?? null) : null;
  const [lessonNotes, setLessonNotes] = useState(initialSnapshot.lessonNotes);
  const [targetSkills, setTargetSkills] = useState(initialSnapshot.targetSkills);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialSnapshot.difficulty);
  const [useMiroBrief, setUseMiroBrief] = useState(initialSnapshot.useMiroBrief);
  const [activityPlan, setActivityPlan] = useState<ActivityPlanEntry[]>(
    initialSnapshot.activityPlan,
  );
  /** Which widget's worked example the preview column is showing, if any. */
  const [previewedActivityType, setPreviewedActivityType] = useState<ActivityType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const student = students?.find((candidate) => candidate._id === studentId) ?? null;
  const history = useQuery(api.students.history, studentId ? { studentId } : "skip");
  const recentHistorySummary = summarizeHistory(history);

  useEffect(function adoptStudentFromCaller() {
    if (initialStudentId) setStudentIds([initialStudentId]);
  }, [initialStudentId]);

  useEffect(function rememberBriefBetweenVisits() {
    writeBuilderSnapshot({
      studentIds,
      lessonNotes,
      targetSkills,
      difficulty,
      useMiroBrief,
      activityPlan,
    });
  }, [
    activityPlan,
    difficulty,
    lessonNotes,
    studentIds,
    targetSkills,
    useMiroBrief,
  ]);

  const miroBoardUrl = useMiroBrief ? (student?.miroBoardUrl ?? null) : null;
  /** Something has to describe the lesson: notes, the board, or saved context. */
  const hasBriefSource =
    lessonNotes.trim().length > 0 ||
    Boolean(miroBoardUrl) ||
    Boolean(student?.contextNotes.trim());
  const hasActivityPlan = activityPlan.length > 0;
  const isPlanTooLarge =
    activityPlan.reduce((total, entry) => total + entry.itemCount, 0) > MAXIMUM_PLANNED_ITEMS;
  const canGenerate =
    Boolean(availability?.isAuthenticated) &&
    !isSubmitting &&
    hasBriefSource &&
    hasActivityPlan &&
    !isPlanTooLarge;

  /**
   * Starts the run and leaves. Generation takes minutes and now lives above the
   * pages, so the teacher gets their workspace back instead of watching a
   * screen — the library shows what is being written, and the draft appears
   * there when it is done.
   */
  async function generate() {
    const recentPerformance = summarizeHistory(history);
    setError(null);
    setIsSubmitting(true);
    try {
      await startGeneration(
        {
          ...(student ? { studentName: student.name, studentContext: student.contextNotes } : {}),
          ...(recentPerformance ? { recentPerformance } : {}),
          lessonNotes,
          ...(miroBoardUrl ? { miroBoardUrl } : {}),
          targetSkills: parseSkills(targetSkills),
          difficulty,
          activityPlan,
        },
        {
          title: student ? `Homework for ${student.name}` : "Homework",
          ...(studentId ? { studentId } : {}),
        },
      );
      // The brief has been handed over, so the next visit starts from a blank
      // page rather than re-offering what was just generated.
      clearBuilderSnapshot();
      onGenerationStarted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation could not be started.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* The review step brings its own header, so this one belongs to the
          brief only — two page titles must never stack. */}
      <PageHeader
        title="Build homework"
        description="Shape the brief and preview the student experience as you go."
      />
    <div className="mx-auto grid max-w-[1580px] gap-10 px-6 py-8 lg:px-10 xl:py-10 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] 2xl:gap-14 2xl:px-12">
      <div className="grid content-start gap-6">
        <SectionHeading
          title="Assignment brief"
          description="Add the lesson context once. Every generated activity is reviewable before anything is shared."
          action={
            <span className="text-[13px] text-muted-foreground">Brief · Review · Publish</span>
          }
        />

        <div className="panel divide-y divide-border/70 overflow-hidden">
          <BriefRow
            title="Students"
            description="Optional. Several assignees keep the set reusable and send it to all of them."
          >
            <StudentMultiPicker
              students={students ?? []}
              value={studentIds}
              onValueChange={setStudentIds}
            />
            {/* The effect of picking a student is the least obvious thing on this
                page, and it changes every activity that gets written. */}
            <p className="mt-2 text-pretty text-[12.5px] leading-5 text-muted-foreground">
              {student ? (
                <>
                  <span className="font-medium text-foreground">
                    This homework is written around {student.name}.
                  </span>{" "}
                  Their saved context and recent results shape what each activity targets.
                  The set stays reusable — nothing names them.
                </>
              ) : studentIds.length > 1 ? (
                <>
                  <span className="font-medium text-foreground">
                    Written for {studentIds.length} students.
                  </span>{" "}
                  With more than one assignee the set stands on its own, so no personal
                  context is used.
                </>
              ) : (
                "Pick one student and the homework is generated from their saved context and recent results. Pick several, or none, and it is written from the lesson brief alone."
              )}
            </p>
            {student ? (
              <StudentContextDisclosure
                key={student._id}
                contextNotes={student.contextNotes}
                isHistoryLoading={history === undefined}
                miroBoardUrl={student.miroBoardUrl}
                recentHistorySummary={recentHistorySummary}
              />
            ) : null}
          </BriefRow>

          <BriefRow
            title="Lesson brief"
            description="What the homework is about — the lesson itself, and where the learner got stuck."
          >
            {student?.miroBoardUrl ? (
              <MiroBriefToggle
                studentName={student.name}
                miroBoardUrl={student.miroBoardUrl}
                isEnabled={useMiroBrief}
                onEnabledChange={setUseMiroBrief}
              />
            ) : null}
            <Field className={student?.miroBoardUrl ? "mt-4" : undefined}>
              <FieldLabel htmlFor="builder-lesson-notes">
                {useMiroBrief && student?.miroBoardUrl ? "Extra details" : "Lesson notes"}
              </FieldLabel>
              <Textarea
                id="builder-lesson-notes"
                rows={6}
                maxLength={MAXIMUM_LESSON_NOTES_LENGTH}
                data-builder-control="lesson-notes"
                value={lessonNotes}
                onChange={(event) => setLessonNotes(event.target.value)}
                placeholder={
                  useMiroBrief && student?.miroBoardUrl
                    ? "Anything the board does not say — where they hesitated, what to push harder on. This wins where it disagrees with the board."
                    : "We practised travel stories and the past perfect. New words: platform, delayed, luggage. Mira keeps using the past simple for the earlier event."
                }
                className="min-h-32 text-[13.5px]"
              />
              <FieldDescription className="text-right numeric">
                {lessonNotes.length.toLocaleString()} / {MAXIMUM_LESSON_NOTES_LENGTH.toLocaleString()}
              </FieldDescription>
            </Field>
          </BriefRow>

          <BriefRow
            title="Skills to reinforce"
            description="Optional comma-separated focus areas."
          >
            <Input
              aria-label="Skills to reinforce"
              value={targetSkills}
              onChange={(event) => setTargetSkills(event.target.value)}
              placeholder="past perfect, sequencing, travel vocabulary"
             
            />
          </BriefRow>

          <BriefRow title="Difficulty" description="The level the activities are written at.">
            <Field>
              <FieldLabel htmlFor="builder-difficulty" className="sr-only">
                Difficulty
              </FieldLabel>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as Difficulty)}
              >
                <SelectTrigger id="builder-difficulty" className="w-full sm:w-64">
                  <SelectValue>{DIFFICULTY_LABELS[difficulty]}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </BriefRow>

          {/* The widget cards need the full column width: beside a label they
              wrap to two words a line. */}
          <BriefRow
            isStacked
            title="Activity types and length"
            description={`Required. Only the types you pick are generated — nothing is invented around them. ${MINIMUM_ACTIVITY_ITEM_COUNT}–${MAXIMUM_ACTIVITY_ITEM_COUNT} items each; the length of the homework is what you ask for here.`}
          >
            <ActivityTypePicker
              plan={activityPlan}
              onChange={setActivityPlan}
              previewed={previewedActivityType}
              onPreview={setPreviewedActivityType}
            />
          </BriefRow>
        </div>

        {error ? (
          <p
            role="alert"
            aria-live="polite"
            className="status-enter rounded-xl border border-destructive/20 bg-critical-soft px-4 py-3.5 text-[13px] text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button size="xl" disabled={!canGenerate} onClick={() => void generate()}>
            {isSubmitting ? "Starting…" : "Generate draft"}
            <ArrowRight size={15} aria-hidden />
          </Button>
          <p
            className={cn(
              "max-w-md text-pretty text-[12.5px] leading-5 text-muted-foreground",
              availability !== null && !availability.isAuthenticated && "text-destructive",
            )}
          >
            {availability === null
              ? "Checking the local Claude runtime…"
              : !availability.isAuthenticated
                ? (availability.problem ?? "Claude is unavailable.")
                : !hasActivityPlan
                  ? "Choose the activity types this homework should contain."
                  : isPlanTooLarge
                    ? `One homework holds at most ${MAXIMUM_PLANNED_ITEMS} practice items. Trim the counts, or split this into two sets.`
                    : !hasBriefSource
                      ? "Add a lesson brief, or pick a student whose saved context can stand in for one."
                      : "Nothing is shared until you review and publish."}
          </p>
          {availability !== null && !availability.isAuthenticated && onOpenClaudeSetup ? (
            <Button variant="outline" onClick={onOpenClaudeSetup}>
              Set up Claude
            </Button>
          ) : null}
        </div>
      </div>

      <BuilderPreview
        studentName={student?.name ?? null}
        lessonNotes={lessonNotes}
        targetSkills={targetSkills}
        activityPlan={activityPlan}
        difficulty={difficulty}
        isGenerating={isSubmitting}
        previewedActivityType={previewedActivityType}
        onPreviewActivityType={setPreviewedActivityType}
      />
    </div>
    </>
  );
}

function BriefRow({
  title,
  description,
  isStacked = false,
  children,
}: {
  title: string;
  description: string;
  /** Puts the control under its label instead of beside it, for wide controls. */
  isStacked?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 px-5 py-5 xl:gap-8 xl:px-6",
        !isStacked && "xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        isStacked && "xl:gap-4",
      )}
    >
      <div className="min-w-0 xl:max-w-[46rem]">
        <FieldTitle>{title}</FieldTitle>
        <p className="mt-1 text-pretty text-[12.5px] leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * The board as the brief. A teacher who ran the lesson on Miro has already
 * written the lesson down there; retyping it into a notes box is the same work
 * twice. The newest frame is the lesson they just taught, so that is what is
 * read — and anything typed below still wins over it.
 */
function MiroBriefToggle({
  studentName,
  miroBoardUrl,
  isEnabled,
  onEnabledChange,
}: {
  studentName: string;
  miroBoardUrl: string;
  isEnabled: boolean;
  onEnabledChange: (isEnabled: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-5 rounded-xl border px-4 py-3.5 transition-colors duration-150",
        isEnabled ? "border-primary/45 bg-primary-soft/50" : "border-border bg-card",
      )}
    >
      <div className="min-w-0">
        <FieldTitle>Use the latest Miro activity as the brief</FieldTitle>
        <p className="mt-1 text-pretty text-[12.5px] leading-5 text-muted-foreground">
          Reads {studentName}&rsquo;s board and takes the most recently created frame as the
          lesson: its topic, examples and vocabulary.{" "}
          <a
            href={miroBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Open the board
            <ExternalLink size={11} className="ml-1 inline align-[-1px]" aria-hidden />
          </a>
        </p>
      </div>
      <Switch
        checked={isEnabled}
        onCheckedChange={onEnabledChange}
        aria-label="Use the latest Miro activity as the lesson brief"
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function StudentContextDisclosure({
  contextNotes,
  isHistoryLoading,
  miroBoardUrl,
  recentHistorySummary,
}: {
  contextNotes: string;
  isHistoryLoading: boolean;
  miroBoardUrl?: string | null;
  recentHistorySummary: string;
}) {
  return (
    <details
      data-builder-context="collapsed"
      className="group mt-3 rounded-xl border border-border/70 bg-muted/40 text-[12.5px] text-secondary-foreground"
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3.5 font-medium text-primary marker:hidden">
        <span>Saved student context</span>
        <span className="ml-auto text-muted-foreground group-open:hidden">Review</span>
        <span className="ml-auto hidden text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <ScrollArea className="max-h-56 border-t border-border/70" viewportClassName="max-h-56">
        <div className="px-3.5 py-3">
          <section>
            <p className="text-[11.5px] font-semibold text-foreground/65">Saved notes</p>
            <p className="mt-1 whitespace-pre-line text-pretty leading-5">
              {contextNotes.trim() || "No saved notes for this student yet."}
            </p>
          </section>
          <section className="mt-3 border-t border-border/70 pt-3">
            <p className="text-[11.5px] font-semibold text-foreground/65">Recent work</p>
            <p className="mt-1 text-pretty leading-5">
              {isHistoryLoading
                ? "Loading recent results…"
                : recentHistorySummary || "No submitted work yet."}
            </p>
          </section>
          {miroBoardUrl ? (
            <a
              href={miroBoardUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              Open Miro <ExternalLink size={13} aria-hidden />
            </a>
          ) : null}
        </div>
      </ScrollArea>
    </details>
  );
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function summarizeHistory(history: ReturnType<typeof useQuery<typeof api.students.history>>) {
  if (!history || history.length === 0) return "";
  const submitted = history.filter((entry) => entry.status === "submitted");
  if (submitted.length === 0) return "";
  const scoreLine = submitted
    .slice(0, RECENT_RESULT_COUNT)
    .map(
      (entry) =>
        `${entry.assignmentTitle}: ${entry.maxAutoScore === 0 ? 0 : Math.round(((entry.score ?? 0) / entry.maxAutoScore) * 100)}%`,
    )
    .join("; ");
  const focusAreas = [...new Set(submitted.flatMap((entry) => entry.focusAreas))].slice(
    0,
    MAXIMUM_FOCUS_AREAS,
  );
  const focusLine = focusAreas.length > 0 ? ` Open focus areas: ${focusAreas.join(", ")}.` : "";
  return `Recent results — ${scoreLine}.${focusLine}`;
}

function readBuilderSnapshot(): BuilderBriefSnapshot {
  const fallback = createEmptyBuilderSnapshot();

  try {
    const serialized = window.localStorage.getItem(BUILDER_STORAGE_KEY);
    if (!serialized) return fallback;
    const parsed: unknown = JSON.parse(serialized);
    if (!isBuilderSnapshot(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function createEmptyBuilderSnapshot(): BuilderBriefSnapshot {
  return {
    studentIds: [],
    lessonNotes: "",
    targetSkills: "",
    difficulty: "intermediate",
    useMiroBrief: false,
    activityPlan: [],
  };
}

function writeBuilderSnapshot(snapshot: BuilderBriefSnapshot) {
  try {
    window.localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // The builder remains fully usable when browser storage is unavailable.
  }
}

function clearBuilderSnapshot() {
  try {
    window.localStorage.removeItem(BUILDER_STORAGE_KEY);
  } catch {
    // Publishing should never fail because browser storage is unavailable.
  }
}

function isBuilderSnapshot(value: unknown): value is BuilderBriefSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const isDifficulty =
    candidate.difficulty === "beginner" ||
    candidate.difficulty === "intermediate" ||
    candidate.difficulty === "advanced";
  const hasStudentIds =
    Array.isArray(candidate.studentIds) &&
    candidate.studentIds.every((studentId) => typeof studentId === "string");
  const hasActivityPlan =
    Array.isArray(candidate.activityPlan) && candidate.activityPlan.every(isActivityPlanEntry);
  return (
    hasStudentIds &&
    hasActivityPlan &&
    typeof candidate.lessonNotes === "string" &&
    typeof candidate.targetSkills === "string" &&
    isDifficulty &&
    typeof candidate.useMiroBrief === "boolean"
  );
}

function isActivityPlanEntry(value: unknown): value is ActivityPlanEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    ACTIVITY_TYPES.some((activityType) => activityType === candidate.type) &&
    typeof candidate.itemCount === "number" &&
    Number.isInteger(candidate.itemCount) &&
    candidate.itemCount >= MINIMUM_ACTIVITY_ITEM_COUNT &&
    candidate.itemCount <= MAXIMUM_ACTIVITY_ITEM_COUNT
  );
}
