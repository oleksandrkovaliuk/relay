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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StudentMultiPicker } from "@/homework/assignment/student-multi-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, type ActivityType, type ClaudeAvailability } from "@/shared/claude";

import { ActivityTypePicker } from "./activity-type-picker";
import { BuilderPreview } from "./builder-preview";

type Difficulty = "beginner" | "intermediate" | "advanced";

type BuilderBriefSnapshot = {
  studentIds: Id<"students">[];
  lessonNotes: string;
  targetSkills: string;
  durationMinutes: number;
  difficulty: Difficulty;
  useMiroBoard: boolean;
  activityTypes: ActivityType[];
};

const BUILDER_STORAGE_KEY = "erm:homework-builder-brief:v1";
const MAXIMUM_LESSON_NOTES_LENGTH = 100_000;
const DEFAULT_DURATION_MINUTES = 15;
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
  const [durationMinutes, setDurationMinutes] = useState(initialSnapshot.durationMinutes);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialSnapshot.difficulty);
  const [useMiroBoard, setUseMiroBoard] = useState(initialSnapshot.useMiroBoard);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>(initialSnapshot.activityTypes);
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
      durationMinutes,
      difficulty,
      useMiroBoard,
      activityTypes,
    });
  }, [
    activityTypes,
    difficulty,
    durationMinutes,
    lessonNotes,
    studentIds,
    targetSkills,
    useMiroBoard,
  ]);

  const canGenerate =
    Boolean(availability?.isAuthenticated) &&
    !isSubmitting &&
    (lessonNotes.trim().length > 0 || Boolean(student?.contextNotes.trim()));

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
          ...(useMiroBoard && student?.miroBoardUrl ? { miroBoardUrl: student.miroBoardUrl } : {}),
          targetSkills: parseSkills(targetSkills),
          durationMinutes,
          difficulty,
          activityTypes,
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
            description="Optional. One student adds their saved context and recent work; several keeps the set reusable and assigns it to all of them."
          >
            <StudentMultiPicker
              students={students ?? []}
              value={studentIds}
              onValueChange={setStudentIds}
            />
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
            title="Lesson notes"
            description="Write naturally — topics covered, examples used, and where the learner got stuck."
          >
            <Field>
              <FieldLabel htmlFor="builder-lesson-notes">Lesson brief</FieldLabel>
              <Textarea
                id="builder-lesson-notes"
                rows={6}
                maxLength={MAXIMUM_LESSON_NOTES_LENGTH}
                data-builder-control="lesson-notes"
                value={lessonNotes}
                onChange={(event) => setLessonNotes(event.target.value)}
                placeholder="We practised travel stories and the past perfect. New words: platform, delayed, luggage. Mira keeps using the past simple for the earlier event."
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

          <BriefRow
            title="Assignment shape"
            description="Set a realistic length and level for this learner."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="builder-duration">Target length</FieldLabel>
                <div className="relative">
                  <Input
                    id="builder-duration"
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(event.target.valueAsNumber || DEFAULT_DURATION_MINUTES)
                    }
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                    min
                  </span>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="builder-difficulty">Difficulty</FieldLabel>
                <NativeSelect
                  id="builder-difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                >
                  <NativeSelectOption value="beginner">Beginner</NativeSelectOption>
                  <NativeSelectOption value="intermediate">Intermediate</NativeSelectOption>
                  <NativeSelectOption value="advanced">Advanced</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
          </BriefRow>

          {/* The widget cards need the full column width: beside a label they
              wrap to two words a line. */}
          <BriefRow
            isStacked
            title="Activity types"
            description="Optional. Pin the homework to specific widgets, or leave blank for a varied mix."
          >
            <ActivityTypePicker
              selected={activityTypes}
              onChange={setActivityTypes}
              previewed={previewedActivityType}
              onPreview={setPreviewedActivityType}
            />
          </BriefRow>

          {student?.miroBoardUrl ? (
            <div className="flex items-center justify-between gap-6 px-5 py-4 xl:px-6">
              <div className="min-w-0">
                <FieldTitle>Use the current Miro board</FieldTitle>
                <p className="mt-1 text-pretty text-[13px] leading-5 text-muted-foreground">
                  Include relevant board context in this generation.
                </p>
              </div>
              <Switch
                checked={useMiroBoard}
                onCheckedChange={setUseMiroBoard}
                aria-label="Include the current Miro board"
                className="shrink-0"
              />
            </div>
          ) : null}
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
              : availability.isAuthenticated
                ? "Nothing is shared until you review and publish."
                : (availability.problem ?? "Claude is unavailable.")}
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
        durationMinutes={durationMinutes}
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
    durationMinutes: DEFAULT_DURATION_MINUTES,
    difficulty: "intermediate",
    useMiroBoard: false,
    activityTypes: [],
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
  const hasActivityTypes =
    Array.isArray(candidate.activityTypes) &&
    candidate.activityTypes.every((value) =>
      ACTIVITY_TYPES.some((activityType) => activityType === value),
    );
  return (
    hasStudentIds &&
    hasActivityTypes &&
    typeof candidate.lessonNotes === "string" &&
    typeof candidate.targetSkills === "string" &&
    typeof candidate.durationMinutes === "number" &&
    Number.isFinite(candidate.durationMinutes) &&
    isDifficulty &&
    typeof candidate.useMiroBoard === "boolean"
  );
}
