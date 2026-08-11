import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useId, useState } from "react";

import { EvilBarChart } from "@/components/charts/recharts-bar-chart";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import type { ChartConfig } from "@/components/charts/recharts-chart";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cn,
  formatRelativeTime,
  humanizeIdentifier,
  initials,
} from "@/lib/utils";
import { SubmissionDetail } from "@/submissions/submission-detail";
import {
  describeInsightScope,
  isInsightFilterActive,
  resolveInsightFilter,
  type InsightSection,
  type InsightsSearch,
} from "./insight-filter";
import { InsightsFilterBar } from "./insights-filter-bar";
import {
  InsightHighlightList,
  InsightHighlightsEmpty,
  InsightHighlightsSkeleton,
} from "./insight-highlights";

const WEAK_ACCURACY_THRESHOLD = 50;
const SKILL_ATTENTION_THRESHOLD = 70;
const STUDENT_ATTENTION_THRESHOLD = 70;
const OUTPERFORMING_STUDENT_THRESHOLD = 80;
const INITIAL_SKILLS_PER_GROUP = 4;
const MAXIMUM_STUDENTS_PER_GROUP = 4;
const MAXIMUM_STUDENTS_PER_SKILL = 3;
const MINIMUM_PROGRESS_PERCENTAGE = 2;
const MAXIMUM_PROGRESS_PERCENTAGE = 100;
const SUBMISSION_CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: -16 };
const METRIC_SKELETON_IDS = ["published", "students", "completion", "score", "time"];
const ROW_SKELETON_IDS = ["first", "second", "third", "fourth"];
const PANEL_CLASS = "panel overflow-hidden";

const CHART_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const SUBMISSION_CHART_CONFIG = {
  submitted: {
    label: "Submitted",
    colors: {
      light: ["var(--chart-4)"],
      dark: ["var(--chart-2)"],
    },
  },
} satisfies ChartConfig;

type OverviewData = FunctionReturnType<typeof api.dashboard.overview>;
type SkillMasteryData = FunctionReturnType<typeof api.dashboard.skillMastery>;
type SkillMasteryItem = SkillMasteryData[number];
type SkillStudentItem = SkillMasteryItem["students"][number];
type StudentPressureData = FunctionReturnType<typeof api.dashboard.studentPressure>;
type StudentPressureItem = StudentPressureData[number];
type QuestionInsightData = FunctionReturnType<typeof api.dashboard.questionInsights>;

interface CanonicalStudentSkill {
  studentId: SkillStudentItem["studentId"];
  name: string;
  attempts: number;
  weightedAccuracy: number;
}

interface CanonicalSkill {
  displayName: string;
  attempts: number;
  weightedAccuracy: number;
  weightedSeconds: number;
  students: Map<SkillStudentItem["studentId"], CanonicalStudentSkill>;
}

export function InsightsView({
  now,
  search,
  onSearchChange,
}: {
  now: number;
  search: InsightsSearch;
  onSearchChange: (next: InsightsSearch) => void;
}) {
  const filter = resolveInsightFilter(search, now);
  const filterArgument = { filter };
  const overview = useQuery(api.dashboard.overview, filterArgument);
  const highlights = useQuery(api.dashboard.highlights, { ...filterArgument, now });
  const skills = useQuery(api.dashboard.skillMastery, filterArgument);
  const questions = useQuery(api.dashboard.questionInsights, filterArgument);
  const students = useQuery(api.dashboard.studentPressure, filterArgument);
  const [openSubmissionId, setOpenSubmissionId] = useState<Id<"submissions"> | null>(null);
  const isFiltered = isInsightFilterActive(search);

  useEffect(function revealRequestedSection() {
    if (!search.section) return;
    document
      .getElementById(sectionElementId(search.section))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [search.section]);

  return (
    <div className="mx-auto grid w-full max-w-[1480px] gap-8 px-6 pb-16 pt-5 lg:px-10 xl:gap-9 xl:pt-6">
      <InsightsFilterBar search={search} now={now} onChange={onSearchChange} />

      <section
        className="grid gap-3"
        id={sectionElementId("highlights")}
        aria-labelledby="insight-findings-heading"
      >
        <SectionHeading
          id="insight-findings-heading"
          title="What stands out"
          description={describeInsightScope(search, currentStudentName(students, search))}
        />
        {highlights === undefined ? (
          <InsightHighlightsSkeleton />
        ) : highlights.length === 0 ? (
          <InsightHighlightsEmpty isFiltered={isFiltered} />
        ) : (
          <InsightHighlightList
            className="min-[900px]:grid-cols-2"
            highlights={highlights}
            onOpenSubmission={setOpenSubmissionId}
          />
        )}
      </section>

      {overview === undefined ? (
        <InsightsLoading />
      ) : (
        <>
          <MetricsOverview overview={overview} />
          <SkillMasteryCard skills={skills} />
          <StudentPerformanceCard now={now} students={students} />
          <SubmissionVolumeCard dailySubmissions={overview.daily} />
          <QuestionInsightsCard questions={questions} />
        </>
      )}

      {openSubmissionId ? (
        <SubmissionDetail
          submissionId={openSubmissionId}
          onClose={() => setOpenSubmissionId(null)}
        />
      ) : null}
    </div>
  );
}

export function sectionElementId(section: InsightSection) {
  return `insight-section-${section}`;
}

/** The filtered student's name, for the scope line under the heading. */
function currentStudentName(students: StudentPressureData | undefined, search: InsightsSearch) {
  if (!search.student) return null;
  return students?.find((student) => student.studentId === search.student)?.name ?? null;
}

function MetricsOverview({ overview }: { overview: OverviewData }) {
  return (
    <section className="grid gap-3" aria-labelledby="metrics-overview-heading">
      <SectionHeading
        id="metrics-overview-heading"
        title="Overview"
      />
      <div className={`${PANEL_CLASS} grid grid-cols-2 lg:grid-cols-5`}>
        <MetricCard
          className="border-b border-r border-border/80 lg:border-b-0"
          label="Published"
          value={String(overview.publishedAssignments)}
        />
        <MetricCard
          className="border-b border-border/80 lg:border-b-0 lg:border-r"
          label="Active students"
          value={String(overview.activeStudents)}
        />
        <MetricCard
          className="border-b border-r border-border/80 lg:border-b-0"
          label="Completion"
          value={`${overview.completionRate}%`}
        />
        <MetricCard
          className="border-b border-border/80 lg:border-b-0 lg:border-r"
          label="Average score"
          value={`${overview.averageScore}%`}
        />
        <MetricCard
          className="col-span-2 lg:col-span-1"
          label="Average time"
          value={`${overview.averageMinutes}m`}
        />
      </div>
    </section>
  );
}

function MetricCard({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0 px-5 py-5 sm:px-6 xl:py-6", className)}>
      <p className="truncate text-[12px] font-medium text-muted-foreground xl:text-[13px]">
        {label}
      </p>
      <p className="numeric mt-2.5 text-[29px] font-semibold leading-none tracking-[-0.045em] text-foreground xl:text-[33px]">
        {value}
      </p>
    </div>
  );
}

function SubmissionVolumeCard({
  dailySubmissions,
}: {
  dailySubmissions: OverviewData["daily"];
}) {
  return (
    <section className="grid gap-3" aria-labelledby="submission-volume-heading">
      <SectionHeading
        id="submission-volume-heading"
        title="Submissions per day"
      />
      <div className={`${PANEL_CLASS} px-5 py-5 sm:px-6 xl:py-6`}>
        <SubmissionChart dailySubmissions={dailySubmissions} />
      </div>
    </section>
  );
}

function SubmissionChart({
  dailySubmissions,
}: {
  dailySubmissions: OverviewData["daily"];
}) {
  if (dailySubmissions.length === 0) {
    return (
      <EmptyPanel
        className="min-h-40"
        title="No submissions yet"
        description="Daily patterns will appear after students complete their first homework."
      />
    );
  }

  const hasSparseHistory = dailySubmissions.length < 3;

  return (
    <div className={cn(hasSparseHistory ? "h-44 lg:h-48" : "h-64 lg:h-72")}>
      <EvilBarChart
        animationType="none"
        chartProps={{ margin: SUBMISSION_CHART_MARGIN }}
        className="h-full aspect-auto"
        config={SUBMISSION_CHART_CONFIG}
        data={dailySubmissions}
        barCategoryGap={8}
        barRadius={5}
      >
        <EvilBarChart.Grid
          stroke="var(--border)"
          strokeDasharray="2 4"
          strokeOpacity={0.8}
          vertical={false}
        />
        <EvilBarChart.XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-sans)", fontSize: 12 }}
          tickFormatter={formatChartDate}
        />
        <EvilBarChart.YAxis
          allowDecimals={false}
          tick={{ fontFamily: "var(--font-sans)", fontSize: 12 }}
          width={28}
        />
        <EvilBarChart.Tooltip roundness="xl" variant="frosted-glass" />
        <EvilBarChart.Bar
          dataKey="submitted"
          radius={5}
          barProps={{ maxBarSize: 30 }}
        />
      </EvilBarChart>
    </div>
  );
}

function formatChartDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return CHART_DATE_FORMATTER.format(date);
}

function canonicalizeSkillMastery(skills: SkillMasteryData): SkillMasteryItem[] {
  const canonicalSkills = new Map<string, CanonicalSkill>();

  for (const skill of skills) {
    const canonicalKey = canonicalSkillKey(skill.skill);
    const current = canonicalSkills.get(canonicalKey) ?? createCanonicalSkill(skill.skill);
    current.attempts += skill.attempts;
    current.weightedAccuracy += skill.accuracy * skill.attempts;
    current.weightedSeconds += skill.averageSeconds * skill.attempts;
    mergeSkillStudents(current.students, skill.students);
    canonicalSkills.set(canonicalKey, current);
  }

  return [...canonicalSkills.values()].map((skill) => ({
    skill: skill.displayName,
    accuracy: weightedAverage(skill.weightedAccuracy, skill.attempts),
    attempts: skill.attempts,
    averageSeconds: weightedAverage(skill.weightedSeconds, skill.attempts),
    students: [...skill.students.values()].map((student) => ({
      studentId: student.studentId,
      name: student.name,
      accuracy: weightedAverage(student.weightedAccuracy, student.attempts),
      attempts: student.attempts,
    })),
  }));
}

function canonicalSkillKey(skill: string) {
  return humanizeIdentifier(skill).toLocaleLowerCase();
}

function createCanonicalSkill(skill: string): CanonicalSkill {
  const displayName = humanizeIdentifier(skill);
  return {
    displayName: `${displayName.charAt(0).toLocaleUpperCase()}${displayName.slice(1)}`,
    attempts: 0,
    weightedAccuracy: 0,
    weightedSeconds: 0,
    students: new Map(),
  };
}

function mergeSkillStudents(
  students: CanonicalSkill["students"],
  incomingStudents: SkillMasteryItem["students"],
) {
  for (const student of incomingStudents) {
    const current = students.get(student.studentId) ?? {
      studentId: student.studentId,
      name: student.name,
      attempts: 0,
      weightedAccuracy: 0,
    };
    current.attempts += student.attempts;
    current.weightedAccuracy += student.accuracy * student.attempts;
    students.set(student.studentId, current);
  }
}

function weightedAverage(weightedTotal: number, attempts: number) {
  if (attempts === 0) return 0;
  return Math.round(weightedTotal / attempts);
}

function SkillMasteryCard({ skills }: { skills: SkillMasteryData | undefined }) {
  return (
    <section id={sectionElementId("skills")}>
      <SectionHeading
        title="Skill mastery"
        description="Named student signals grouped into the skills that need support and those building strength."
      />
      <div className={`${PANEL_CLASS} mt-3`}>
        <SkillMasteryContent skills={skills} />
      </div>
    </section>
  );
}

function SkillMasteryContent({ skills }: { skills: SkillMasteryData | undefined }) {
  if (skills === undefined) {
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelRowsSkeleton />
      </div>
    );
  }
  if (skills.length === 0) {
    return (
      <EmptyPanel
        title="No graded skills yet"
        description="Skill accuracy will appear after the first graded submission."
      />
    );
  }

  const canonicalSkills = canonicalizeSkillMastery(skills);
  const needsAttention = canonicalSkills
    .filter((skill) => skill.accuracy < SKILL_ATTENTION_THRESHOLD)
    .toSorted((left, right) => left.accuracy - right.accuracy);
  const strongSignals = canonicalSkills
    .filter((skill) => skill.accuracy >= SKILL_ATTENTION_THRESHOLD)
    .toSorted((left, right) => right.accuracy - left.accuracy);

  return (
    <div className="grid min-[900px]:grid-cols-2">
      <SkillSignalGroup
        description={`Below ${SKILL_ATTENTION_THRESHOLD}% accuracy`}
        emptyDescription="Every measured skill is currently at or above the support threshold."
        skills={needsAttention}
        title="Needs attention"
        tone="attention"
      />
      <SkillSignalGroup
        className="border-t border-border/80 min-[900px]:border-l min-[900px]:border-t-0"
        description={`${SKILL_ATTENTION_THRESHOLD}% accuracy or higher`}
        emptyDescription="Strong signals will appear as accuracy improves."
        skills={strongSignals}
        title="Strong signals"
        tone="strong"
      />
    </div>
  );
}

function SkillSignalGroup({
  className,
  description,
  emptyDescription,
  skills,
  title,
  tone,
}: {
  className?: string;
  description: string;
  emptyDescription: string;
  skills: SkillMasteryItem[];
  title: string;
  tone: "attention" | "strong";
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const skillListId = useId();
  const hasAdditionalSkills = skills.length > INITIAL_SKILLS_PER_GROUP;
  const visibleSkills = isExpanded ? skills : skills.slice(0, INITIAL_SKILLS_PER_GROUP);

  return (
    <section className={cn("min-w-0", className)} aria-label={title}>
      <header className="flex items-baseline justify-between gap-4 border-b border-border/80 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground xl:text-[15px]">
            {title}
          </h3>
          <p className="mt-0.5 text-[12px] text-secondary-foreground xl:text-[13px]">
            {description}
          </p>
        </div>
        <span className="numeric shrink-0 text-[12px] font-medium text-secondary-foreground xl:text-[13px]">
          {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </span>
      </header>

      {skills.length === 0 ? (
        <p className="px-5 py-6 text-[13px] leading-5 text-secondary-foreground sm:px-6 xl:text-sm">
          {emptyDescription}
        </p>
      ) : (
        <div className="divide-y divide-border/80" id={skillListId}>
          {visibleSkills.map((skill) => (
            <SkillMasteryRow key={skill.skill} skill={skill} tone={tone} />
          ))}
        </div>
      )}

      {hasAdditionalSkills ? (
        <div className="border-t border-border/80 px-3 py-2 sm:px-4">
          <Button
            aria-controls={skillListId}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Show fewer ${title.toLocaleLowerCase()} skills`
                : `View all ${skills.length} ${title.toLocaleLowerCase()} skills`
            }
            className="min-h-8 px-2.5 text-[12.5px] xl:text-[13.5px]"
            onClick={() => setIsExpanded((isOpen) => !isOpen)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? "Show less" : `View all ${skills.length}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function SkillMasteryRow({
  skill,
  tone,
}: {
  skill: SkillMasteryItem;
  tone: "attention" | "strong";
}) {
  const progressPercentage = Math.max(
    MINIMUM_PROGRESS_PERCENTAGE,
    Math.min(MAXIMUM_PROGRESS_PERCENTAGE, skill.accuracy),
  );
  const namedStudents = skill.students
    .toSorted((left, right) =>
      tone === "attention"
        ? left.accuracy - right.accuracy || right.attempts - left.attempts
        : right.accuracy - left.accuracy || right.attempts - left.attempts,
    )
    .slice(0, MAXIMUM_STUDENTS_PER_SKILL);

  return (
    <article className="px-5 py-4 sm:px-6 xl:py-5">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="min-w-0 truncate text-[14px] font-semibold text-foreground xl:text-[15px]">
          {humanizeIdentifier(skill.skill)}
        </h4>
        <span
          className={cn(
            "numeric shrink-0 text-[13px] font-semibold xl:text-sm",
            tone === "attention" && "text-destructive",
          )}
        >
          {skill.accuracy}%
        </span>
      </div>
      <div
        aria-label={`${humanizeIdentifier(skill.skill)} accuracy`}
        aria-valuemax={MAXIMUM_PROGRESS_PERCENTAGE}
        aria-valuemin={0}
        aria-valuenow={skill.accuracy}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "attention" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="numeric mt-2 flex items-center justify-between gap-3 text-[12px] text-secondary-foreground xl:text-[13px]">
        <span>
          {skill.attempts} {skill.attempts === 1 ? "attempt" : "attempts"}
        </span>
        <span>{skill.averageSeconds}s average</span>
      </div>

      {namedStudents.length > 0 ? (
        <div className="mt-2.5">
          <p className="text-[12px] font-medium text-foreground xl:text-[13px]">
            {tone === "attention" ? "Support" : "Leading"}
          </p>
          <ul
            aria-label={`${tone === "attention" ? "Students needing support" : "Leading students"} in ${skill.skill}`}
            className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5"
          >
            {namedStudents.map((student) => (
              <li
                className="flex min-w-0 items-center gap-1.5 text-[12px] text-secondary-foreground xl:text-[13px]"
                key={student.studentId}
              >
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[8px] font-semibold text-secondary-foreground"
                >
                  {initials(student.name)}
                </span>
                <span className="max-w-32 truncate">{student.name}</span>
                <span className="numeric font-medium text-foreground">
                  {student.accuracy}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function StudentPerformanceCard({
  now,
  students,
}: {
  now: number;
  students: StudentPressureData | undefined;
}) {
  return (
    <section id={sectionElementId("students")}>
      <SectionHeading
        title="Student performance"
        description="A focused follow-up list alongside students whose completed work is standing out."
      />
      <div className={`${PANEL_CLASS} mt-3`}>
        <StudentPerformanceContent now={now} students={students} />
      </div>
    </section>
  );
}

function StudentPerformanceContent({
  now,
  students,
}: {
  now: number;
  students: StudentPressureData | undefined;
}) {
  if (students === undefined) {
    return (
      <div className="grid min-[900px]:grid-cols-2">
        <div className="px-5 py-5 sm:px-6">
          <PanelRowsSkeleton />
        </div>
        <div className="border-t border-border/80 px-5 py-5 sm:px-6 min-[900px]:border-l min-[900px]:border-t-0">
          <PanelRowsSkeleton />
        </div>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <EmptyPanel
        title="No students yet"
        description="Add a student to begin tracking progress and activity."
      />
    );
  }

  const studentsNeedingAttention = students
    .filter(needsStudentAttention)
    .toSorted(compareStudentsNeedingAttention)
    .slice(0, MAXIMUM_STUDENTS_PER_GROUP);
  const outperformingStudents = students
    .filter(isOutperformingStudent)
    .toSorted(compareOutperformingStudents)
    .slice(0, MAXIMUM_STUDENTS_PER_GROUP);

  return (
    <div className="grid min-[900px]:grid-cols-2">
      <StudentPerformanceGroup
        description={`Open work or below ${STUDENT_ATTENTION_THRESHOLD}% average`}
        emptyDescription="No students currently meet the follow-up criteria."
        now={now}
        students={studentsNeedingAttention}
        title="Needs follow-up"
        tone="attention"
      />
      <StudentPerformanceGroup
        className="border-t border-border/80 min-[900px]:border-l min-[900px]:border-t-0"
        description={`${OUTPERFORMING_STUDENT_THRESHOLD}% average or higher, with no open work`}
        emptyDescription="Standout students will appear after more graded work."
        now={now}
        students={outperformingStudents}
        title="Outperforming"
        tone="outperforming"
      />
    </div>
  );
}

function needsStudentAttention(student: StudentPressureItem) {
  const hasLowAverage =
    student.submittedCount > 0 && student.averageScore < STUDENT_ATTENTION_THRESHOLD;
  return student.openCount > 0 || hasLowAverage;
}

function isOutperformingStudent(student: StudentPressureItem) {
  return (
    student.openCount === 0 &&
    student.submittedCount > 0 &&
    student.averageScore >= OUTPERFORMING_STUDENT_THRESHOLD
  );
}

function compareStudentsNeedingAttention(
  left: StudentPressureItem,
  right: StudentPressureItem,
) {
  const leftScore = left.submittedCount > 0 ? left.averageScore : -1;
  const rightScore = right.submittedCount > 0 ? right.averageScore : -1;
  return (
    leftScore - rightScore ||
    right.openCount - left.openCount ||
    (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0) ||
    left.name.localeCompare(right.name)
  );
}

function compareOutperformingStudents(
  left: StudentPressureItem,
  right: StudentPressureItem,
) {
  return (
    right.averageScore - left.averageScore ||
    right.submittedCount - left.submittedCount ||
    (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0) ||
    left.name.localeCompare(right.name)
  );
}

function StudentPerformanceGroup({
  className,
  description,
  emptyDescription,
  now,
  students,
  title,
  tone,
}: {
  className?: string;
  description: string;
  emptyDescription: string;
  now: number;
  students: StudentPressureItem[];
  title: string;
  tone: "attention" | "outperforming";
}) {
  return (
    <section className={cn("min-w-0", className)} aria-label={title}>
      <header className="flex items-baseline justify-between gap-4 border-b border-border/80 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground xl:text-[15px]">
            {title}
          </h3>
          <p className="mt-0.5 text-[12px] text-secondary-foreground xl:text-[13px]">
            {description}
          </p>
        </div>
        <span className="numeric shrink-0 text-[12px] font-medium text-secondary-foreground xl:text-[13px]">
          {students.length}
        </span>
      </header>

      {students.length === 0 ? (
        <p className="px-5 py-6 text-[13px] leading-5 text-secondary-foreground sm:px-6 xl:text-sm">
          {emptyDescription}
        </p>
      ) : (
        <div className="divide-y divide-border/80">
          {students.map((student) => (
            <StudentPressureRow
              key={student.studentId}
              now={now}
              student={student}
              tone={tone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StudentPressureRow({
  now,
  student,
  tone,
}: {
  now: number;
  student: StudentPressureItem;
  tone: "attention" | "outperforming";
}) {
  const hasSubmittedWork = student.submittedCount > 0;
  const hasWeakAverage =
    hasSubmittedWork && student.averageScore < STUDENT_ATTENTION_THRESHOLD;
  const lastActivity = student.lastActivityAt
    ? formatRelativeTime(student.lastActivityAt, now)
    : "No activity yet";

  return (
    <article className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 sm:px-6">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-secondary-foreground"
      >
        {initials(student.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold text-foreground xl:text-[14.5px]">
          {student.name}
        </p>
        <div className="numeric mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-secondary-foreground xl:text-[12.5px]">
          {student.openCount > 0 ? <span>{student.openCount} open</span> : null}
          {student.openCount > 0 ? <span aria-hidden="true">·</span> : null}
          <span>{student.submittedCount} submitted</span>
          <span aria-hidden="true">·</span>
          <span>{lastActivity}</span>
        </div>
      </div>
      <span
        className={cn(
          "numeric shrink-0 text-[12.5px] font-semibold xl:text-[13.5px]",
          !hasSubmittedWork && "text-muted-foreground",
          hasWeakAverage && "text-destructive",
          tone === "outperforming" && "text-primary",
        )}
      >
        {hasSubmittedWork ? `${student.averageScore}% avg.` : "Not scored"}
      </span>
    </article>
  );
}

function QuestionInsightsCard({
  questions,
}: {
  questions: QuestionInsightData | undefined;
}) {
  return (
    <section id={sectionElementId("questions")}>
      <SectionHeading
        title="Questions that cost the most"
        description="Low accuracy, long response times, and repeated edits point to uncertainty."
      />
      <QuestionInsightsContent questions={questions} />
    </section>
  );
}

function QuestionInsightsContent({
  questions,
}: {
  questions: QuestionInsightData | undefined;
}) {
  if (questions === undefined) {
    return (
      <div className={`${PANEL_CLASS} mt-3 px-5 py-6`}>
        <TableRowsSkeleton />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className={`${PANEL_CLASS} mt-3`}>
        <EmptyPanel
          title="No question insights yet"
          description="Question-level patterns will appear after answers are graded."
        />
      </div>
    );
  }

  return (
    <ScrollArea orientation="horizontal" className={`${PANEL_CLASS} mt-3`}>
      <table className="w-full min-w-[760px] text-[13px] lg:text-sm">
        <caption className="sr-only">
          Question performance ordered from lowest to highest accuracy
        </caption>
        <thead>
          <tr className="bg-muted/50 text-xs text-secondary-foreground">
            <th className="px-4 py-3 text-left font-medium sm:px-5" scope="col">
              Question
            </th>
            <th className="px-3 py-3 text-right font-medium" scope="col">
              Accuracy
            </th>
            <th className="px-3 py-3 text-right font-medium" scope="col">
              Avg. time
            </th>
            <th className="px-3 py-3 text-right font-medium" scope="col">
              Avg. lookups
            </th>
            <th className="px-4 py-3 text-right font-medium sm:px-5" scope="col">
              Edits
            </th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => {
            const isWeak = question.accuracy < WEAK_ACCURACY_THRESHOLD;
            return (
              <tr
                key={question.questionId}
                className="border-b border-border/70 last:border-b-0 hover:bg-muted/30"
              >
                <td className="max-w-[40rem] px-4 py-4 align-top sm:px-5">
                  <p className="line-clamp-2 font-medium leading-5 text-foreground lg:leading-6" title={question.prompt}>
                    {question.prompt}
                  </p>
                  <p className="mt-1 truncate text-xs text-secondary-foreground lg:text-[13px]">
                    {question.assignmentTitle} · {formatQuestionType(question.type)} ·{" "}
                    {question.attempts} {question.attempts === 1 ? "attempt" : "attempts"}
                  </p>
                </td>
                <td
                  className={cn(
                    "numeric px-3 py-4 text-right align-top font-semibold",
                    isWeak && "text-destructive",
                  )}
                >
                  {question.accuracy}%
                </td>
                <td className="numeric px-3 py-4 text-right align-top">
                  {question.averageSeconds}s
                </td>
                <td className="numeric px-3 py-4 text-right align-top">
                  {question.averageLookups}
                </td>
                <td className="numeric px-4 py-4 text-right align-top sm:px-5">
                  {question.averageRevisions}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function formatQuestionType(questionType: string) {
  return questionType.replaceAll("_", " ");
}

function EmptyPanel({
  className,
  description,
  title,
}: {
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "grid place-content-center px-5 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground lg:text-[15px]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-secondary-foreground lg:text-sm">
        {description}
      </p>
    </div>
  );
}

function PanelRowsSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      {ROW_SKELETON_IDS.map((rowId) => (
        <div key={rowId}>
          <div className="flex justify-between gap-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {ROW_SKELETON_IDS.slice(0, 3).map((rowId) => (
        <div className="flex items-center justify-between gap-8" key={rowId}>
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function InsightsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading insights"
      className="mx-auto grid max-w-[1560px] gap-8 px-5 pb-16 pt-5 sm:px-8 lg:gap-10 lg:px-12 lg:pt-7 2xl:px-16"
    >
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-7 border-b border-border/80 pb-8 sm:grid-cols-3 lg:grid-cols-5 lg:pb-10"
        aria-hidden="true"
      >
        {METRIC_SKELETON_IDS.map((metricId) => (
          <div key={metricId}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div
        className="grid gap-9 border-b border-border/80 pb-10 xl:grid-cols-2 xl:gap-0"
        aria-hidden="true"
      >
        <section className="xl:border-r xl:border-border/80 xl:pr-10">
          <Skeleton className="h-5 w-32" />
          <PanelRowsSkeleton />
        </section>
        <section className="xl:pl-10">
          <Skeleton className="h-5 w-36" />
          <PanelRowsSkeleton />
        </section>
      </div>
      <div
        className="grid gap-9 border-b border-border/80 pb-10 xl:grid-cols-2 xl:gap-0"
        aria-hidden="true"
      >
        <section className="xl:border-r xl:border-border/80 xl:pr-10">
          <Skeleton className="h-5 w-36" />
          <PanelRowsSkeleton />
        </section>
        <section className="xl:pl-10">
          <Skeleton className="h-5 w-32" />
          <PanelRowsSkeleton />
        </section>
      </div>
      <section className="border-b border-border/80 pb-10" aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3.5 w-60" />
        <Skeleton className="mt-6 h-64 w-full lg:h-72" />
      </section>
    </div>
  );
}
