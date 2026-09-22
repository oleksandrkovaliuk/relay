import { useConvex } from "convex/react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@/lib/convex-query";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useEffect, useState, useDeferredValue } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useGenerationRuns } from "@/claude/generation-runs";
import { PageHeader } from "@/app/workspace-shell";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import {
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
  const convex = useConvex();
  const teachingStyle = useQuery(api.teaching.styleProfile, {});
  const { start: startGeneration } = useGenerationRuns();

  const [initialSnapshot] = useState(() =>
    startFresh ? createEmptyBuilderSnapshot() : readBuilderSnapshot(),
  );
  const [studentIds, setStudentIds] = useState<Id<"students">[]>(
    initialStudentId ? [initialStudentId] : initialSnapshot.studentIds,
  );
  /** One selected board can supply a lesson; every selected learner supplies context. */
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
  const deferredNotes = useDeferredValue(lessonNotes);
  const deferredSkills = useDeferredValue(targetSkills);
  const selectedStudents = students?.filter((candidate) => studentIds.includes(candidate._id)) ?? [];

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
    selectedStudents.some((candidate) => candidate.contextNotes.trim());
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
    if (!canGenerate) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const learnerContext = await convex.query(api.teaching.learnerContext, { studentIds });
      await startGeneration(
        {
          ...(student ? { studentName: student.name } : {}),
          ...learnerContext,
          lessonNotes,
          ...(miroBoardUrl ? { miroBoardUrl } : {}),
          targetSkills: parseSkills(targetSkills),
          difficulty,
          activityPlan,
        },
        {
          title: student ? `Homework for ${student.name}` : "Homework",
          ...(studentId ? { studentId } : {}),
          studentIds,
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
      <PageHeader title="New homework" description="Add lesson notes, select students, and choose the activities." action={<Button size="lg" disabled={!canGenerate} onClick={() => void generate()}>{isSubmitting ? "Starting…" : "Generate draft"}<ArrowRight size={16} aria-hidden /></Button>} />
      {/* The same page frame as every other page, so the header's action lands
          over the right edge of the form instead of beyond it. */}
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 pt-6 lg:px-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm focus-within:border-input">
          <label htmlFor="builder-lesson-notes" className="block px-5 pt-5 text-sm font-medium">Lesson notes</label>
          <textarea id="builder-lesson-notes" rows={4} maxLength={MAXIMUM_LESSON_NOTES_LENGTH}
            value={lessonNotes} onChange={(event) => setLessonNotes(event.target.value)}
            placeholder="What did you cover? Add examples, vocabulary, or anything that needs more practice."
            className="min-h-32 w-full resize-y bg-transparent px-5 pb-4 pt-3 text-[14px] leading-6 outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex flex-wrap items-end gap-4 border-t border-border/60 bg-muted/20 px-5 py-4">
            <div className="min-w-52 flex-1"><p className="mb-2 text-xs font-medium">Students<span className="ml-1 font-normal text-muted-foreground">optional</span></p><StudentMultiPicker students={students ?? []} value={studentIds} onValueChange={setStudentIds} /></div>
            <div><label htmlFor="builder-difficulty" className="mb-2 block text-xs font-medium">Level</label><Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
              <SelectTrigger aria-label="Homework level" id="builder-difficulty" className="w-auto min-w-40 rounded-xl border-border bg-card shadow-none data-[size=default]:h-11"><SelectValue>{DIFFICULTY_LABELS[difficulty]}</SelectValue></SelectTrigger>
              <SelectContent align="start"><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent>
            </Select></div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-[12px] text-muted-foreground">
          <span>{isSubmitting ? "Preparing your draft…" : "You can edit the draft before publishing."}</span>
          <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-md hover:text-foreground">{teachingStyle?.styleNotes.trim() ? "Your teaching style is included" : "Add your teaching preferences"}</Link>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-critical-soft p-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-8 grid gap-6">
          {student ? <StudentContextDisclosure key={student._id} contextNotes={student.contextNotes} isHistoryLoading={history === undefined} miroBoardUrl={student.miroBoardUrl} recentHistorySummary={recentHistorySummary} /> : null}
          {studentIds.length > 1 ? <div className="rounded-2xl bg-muted/50 px-5 py-4 text-[13px] leading-6"><span className="font-medium">Personalised for {studentIds.length} students.</span> Their saved context and recent results shape the shared practice. Names stay out of the worksheet.</div> : null}
          {student?.miroBoardUrl ? <MiroBriefToggle studentName={student.name} miroBoardUrl={student.miroBoardUrl} isEnabled={useMiroBrief} onEnabledChange={setUseMiroBrief} /> : null}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/40 px-5 py-4">
            <label htmlFor="builder-skills" className="text-xs font-medium">Focus skills<span className="ml-1 font-normal text-muted-foreground">optional</span></label>
            <Input id="builder-skills" value={targetSkills} onChange={(event) => setTargetSkills(event.target.value)} placeholder="e.g. past tense, asking questions, travel" className="h-11 min-w-52 flex-1 rounded-xl border-0 bg-card" />
          </div>
          <section>
            <SectionHeading title="Activities" description="Select types and item counts. Use Example to try a format." />
            <div className="mt-4"><ActivityTypePicker plan={activityPlan} onChange={setActivityPlan} previewed={previewedActivityType} onPreview={setPreviewedActivityType} /></div>
          </section>
          {previewedActivityType ? <BuilderPreview studentName={student?.name ?? null} lessonNotes={deferredNotes} targetSkills={deferredSkills} activityPlan={activityPlan} difficulty={difficulty} isGenerating={isSubmitting} previewedActivityType={previewedActivityType} onPreviewActivityType={setPreviewedActivityType} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="max-w-lg text-[12.5px] leading-5 text-muted-foreground">
              {availability === null ? "Checking Claude…" : !availability.isAuthenticated ? availability.problem ?? "Connect Claude in Settings to generate homework." : !hasActivityPlan ? "Choose at least one activity type to continue." : isPlanTooLarge ? `Keep this set within ${MAXIMUM_PLANNED_ITEMS} practice items.` : !hasBriefSource ? "Add lesson notes, or choose a student with saved context." : difficulty === "beginner" ? "Beginner: natural language, worked examples, and thoughtful practice with support." : "Ready to create a draft using your brief and selected context."}
            </p>
            {availability !== null && !availability.isAuthenticated ? <Button variant="outline" size="lg" nativeButton={false} render={<Link to="/settings" />}>Connect Claude</Button> : null}
          </div>
        </div>
      </div>
    </>
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
