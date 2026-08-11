import { CrownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, Clock3, Eye, Inbox, Star } from "lucide-react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ScoreBar } from "@/components/score-bar";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  formatRelativeTime,
  humanizeIdentifier,
  initials,
  isSameDay,
} from "@/lib/utils";
import { getDesktopBridge } from "@/claude/desktop-bridge";
import type { InsightSection } from "@/insights/insight-filter";
import {
  InsightHighlightList,
  InsightHighlightsEmpty,
  InsightHighlightsSkeleton,
} from "@/insights/insight-highlights";
import { SubmissionDetail } from "@/submissions/submission-detail";
import { HomeworkGlyph } from "@/homework/homework-glyph";

type FeedItem = NonNullable<ReturnType<typeof useFeed>>[number];

const PANEL_CLASS = "panel overflow-hidden";
const MAXIMUM_ATTENTION_STUDENTS = 4;
/** Today is a preview: enough findings to act on, not the whole page. */
const PREVIEW_HIGHLIGHT_COUNT = 3;

type StudentMomentum = {
  key: string;
  name: string;
  completedCount: number;
  answeredCount: number;
  questionCount: number;
  lastActivityAt: number;
  latestSubmissionId: Id<"submissions">;
};

type AttentionSubmission = {
  submissionId: Id<"submissions">;
  pendingReviewCount: number;
  strugglingSkillCount: number;
  activityAt: number;
};

type StudentAttention = {
  key: string;
  name: string;
  pendingReviewCount: number;
  strugglingSkills: string[];
  lastActivityAt: number;
  actionableSubmission: AttentionSubmission;
};

function useFeed() {
  return useQuery(api.feed.inbox);
}

export function TodayFeed({ now }: { now: number }) {
  const feed = useFeed();
  const [openSubmissionId, setOpenSubmissionId] = useState<Id<"submissions"> | null>(null);

  if (feed === undefined) return <LoadingRow />;

  const todayItems = feed.filter(
    (item) =>
      isSameDay(item.startedAt, now) ||
      (item.submittedAt !== undefined && isSameDay(item.submittedAt, now)),
  );
  const submittedToday = todayItems.filter(
    (item) => item.submittedAt !== undefined && isSameDay(item.submittedAt, now),
  );
  const activeStudentCount = new Set(todayItems.map(getStudentKey)).size;
  const pendingReviewCount = feed.reduce(
    (total, item) => total + item.pendingReviewCount,
    0,
  );
  const completionMomentum = percentage(submittedToday.length, todayItems.length);
  const highlightedStudent = findMomentumLeader(todayItems);
  const studentsNeedingAttention = buildStudentAttention(feed).slice(
    0,
    MAXIMUM_ATTENTION_STUDENTS,
  );

  return (
    <div className="mx-auto grid w-full max-w-[1480px] gap-7 px-6 py-6 lg:px-10 xl:gap-8 xl:py-8">
      <section className="grid gap-3" aria-labelledby="overview-heading">
        <SectionHeading id="overview-heading" title="Today at a glance" />
        <div className={PANEL_CLASS}>
          <div className="grid grid-cols-2 xl:grid-cols-4" aria-label="Today at a glance">
            <StatTile
              className="border-b border-r border-border/80 xl:border-b-0"
              label="Completed today"
              value={submittedToday.length}
              detail={pluralize(submittedToday.length, "task")}
            />
            <StatTile
              className="border-b border-border/80 xl:border-b-0 xl:border-r"
              label="Active students"
              value={activeStudentCount}
              detail="today"
            />
            <StatTile
              className="border-r border-border/80"
              label="Pending review"
              value={pendingReviewCount}
              detail="written answers"
            />
            <StatTile
              label="Completion momentum"
              value={completionMomentum}
              suffix="%"
              detail={`${submittedToday.length}/${todayItems.length} tasks`}
            />
          </div>
        </div>
      </section>

      <InsightsPreview now={now} onOpenSubmission={setOpenSubmissionId} />

      <section className="grid gap-3" aria-labelledby="student-signals-heading">
        <SectionHeading
          id="student-signals-heading"
          title="Student signals"
          action={<ViewAllInsights section="students" label="Student performance" />}
        />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <MomentumHighlight
            student={highlightedStudent}
            onOpenSubmission={setOpenSubmissionId}
          />
          <StudentAttentionList
            students={studentsNeedingAttention}
            onOpenSubmission={setOpenSubmissionId}
          />
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="activity-heading">
        <SectionHeading
          id="activity-heading"
          title="Recent activity"
          action={<ViewAllInsights section="questions" label="Question insights" />}
        />
        {feed.length === 0 ? (
          <div className={PANEL_CLASS}>
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <Inbox className="text-muted-foreground" size={22} aria-hidden />
              <p className="mt-3 text-[15px] font-semibold xl:text-[16px]">
                Nothing submitted yet
              </p>
              <p className="mt-1.5 max-w-md text-[13px] leading-6 text-muted-foreground xl:text-[14px]">
                Publish homework and share the link. Submissions land here the moment they
                arrive.
              </p>
            </div>
          </div>
        ) : (
          <div className={`${PANEL_CLASS} divide-y divide-border/80`}>
            {feed.map((item) => (
              <FeedCard
                key={item.submissionId}
                item={item}
                now={now}
                onOpen={() => setOpenSubmissionId(item.submissionId)}
              />
            ))}
          </div>
        )}
      </section>

      {openSubmissionId ? (
        <SubmissionDetail
          submissionId={openSubmissionId}
          onClose={() => setOpenSubmissionId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * The short version of Insights: the top findings across all students, with the
 * way through to the full page and its filters.
 */
function InsightsPreview({
  now,
  onOpenSubmission,
}: {
  now: number;
  onOpenSubmission: (submissionId: Id<"submissions">) => void;
}) {
  const highlights = useQuery(api.dashboard.highlights, { now });

  return (
    <section className="grid gap-3" aria-labelledby="insights-preview-heading">
      <SectionHeading
        id="insights-preview-heading"
        title="What stands out"
        action={<ViewAllInsights section="highlights" label="All insights" />}
      />
      {highlights === undefined ? (
        <InsightHighlightsSkeleton rows={PREVIEW_HIGHLIGHT_COUNT} />
      ) : highlights.length === 0 ? (
        <InsightHighlightsEmpty isFiltered={false} />
      ) : (
        <InsightHighlightList
          highlights={highlights.slice(0, PREVIEW_HIGHLIGHT_COUNT)}
          onOpenSubmission={onOpenSubmission}
        />
      )}
    </section>
  );
}

/** Sends the teacher to the matching part of Insights, not just its top. */
function ViewAllInsights({ section, label }: { section: InsightSection; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      aria-label={`View all insights: ${label}`}
      render={<Link to="/insights" search={{ section }} />}
    >
      View all
      <ArrowRight size={14} aria-hidden />
    </Button>
  );
}

function percentage(part: number, whole: number) {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

function getStudentKey(item: FeedItem) {
  return item.studentId ?? `name:${item.studentName.toLocaleLowerCase()}`;
}

function findMomentumLeader(items: FeedItem[]): StudentMomentum | null {
  const students = new Map<string, StudentMomentum>();
  for (const item of items) {
    const key = getStudentKey(item);
    const current = students.get(key) ?? {
      key,
      name: item.studentName,
      completedCount: 0,
      answeredCount: 0,
      questionCount: 0,
      lastActivityAt: 0,
      latestSubmissionId: item.submissionId,
    };
    const activityAt = item.submittedAt ?? item.startedAt;
    current.completedCount += item.status === "submitted" ? 1 : 0;
    current.answeredCount += Math.min(item.answeredCount, item.questionCount);
    current.questionCount += item.questionCount;
    if (
      activityAt > current.lastActivityAt ||
      (activityAt === current.lastActivityAt &&
        item.submissionId.localeCompare(current.latestSubmissionId) > 0)
    ) {
      current.latestSubmissionId = item.submissionId;
    }
    current.lastActivityAt = Math.max(current.lastActivityAt, activityAt);
    students.set(key, current);
  }

  return (
    [...students.values()].toSorted((left, right) => {
      const completedDifference = right.completedCount - left.completedCount;
      if (completedDifference !== 0) return completedDifference;
      const progressDifference =
        percentage(right.answeredCount, right.questionCount) -
        percentage(left.answeredCount, left.questionCount);
      if (progressDifference !== 0) return progressDifference;
      const answeredDifference = right.answeredCount - left.answeredCount;
      if (answeredDifference !== 0) return answeredDifference;
      const recencyDifference = right.lastActivityAt - left.lastActivityAt;
      if (recencyDifference !== 0) return recencyDifference;
      return left.name.localeCompare(right.name);
    })[0] ?? null
  );
}

function buildStudentAttention(items: FeedItem[]): StudentAttention[] {
  const students = new Map<
    string,
    Omit<StudentAttention, "strugglingSkills"> & { strugglingSkills: Set<string> }
  >();

  for (const item of items) {
    if (item.strugglingSkills.length === 0 && item.pendingReviewCount === 0) continue;
    const key = getStudentKey(item);
    const actionableSubmission: AttentionSubmission = {
      submissionId: item.submissionId,
      pendingReviewCount: item.pendingReviewCount,
      strugglingSkillCount: item.strugglingSkills.length,
      activityAt: item.submittedAt ?? item.startedAt,
    };
    const current = students.get(key) ?? {
      key,
      name: item.studentName,
      pendingReviewCount: 0,
      strugglingSkills: new Set<string>(),
      lastActivityAt: 0,
      actionableSubmission,
    };
    current.pendingReviewCount += item.pendingReviewCount;
    current.lastActivityAt = Math.max(
      current.lastActivityAt,
      item.submittedAt ?? item.startedAt,
    );
    current.actionableSubmission = selectMoreActionableSubmission(
      current.actionableSubmission,
      actionableSubmission,
    );
    for (const skill of item.strugglingSkills) current.strugglingSkills.add(skill);
    students.set(key, current);
  }

  return [...students.values()]
    .map((student) => ({
      ...student,
      strugglingSkills: canonicalizeSkillLabels([...student.strugglingSkills]),
    }))
    .toSorted((left, right) => {
      const skillDifference = right.strugglingSkills.length - left.strugglingSkills.length;
      if (skillDifference !== 0) return skillDifference;
      const reviewDifference = right.pendingReviewCount - left.pendingReviewCount;
      if (reviewDifference !== 0) return reviewDifference;
      return right.lastActivityAt - left.lastActivityAt;
    });
}

function selectMoreActionableSubmission(
  current: AttentionSubmission,
  candidate: AttentionSubmission,
) {
  const currentHasReview = Number(current.pendingReviewCount > 0);
  const candidateHasReview = Number(candidate.pendingReviewCount > 0);
  const reviewPriority = candidateHasReview - currentHasReview;
  if (reviewPriority !== 0) return reviewPriority > 0 ? candidate : current;

  const reviewCountPriority = candidate.pendingReviewCount - current.pendingReviewCount;
  if (reviewCountPriority !== 0) return reviewCountPriority > 0 ? candidate : current;

  const skillPriority = candidate.strugglingSkillCount - current.strugglingSkillCount;
  if (skillPriority !== 0) return skillPriority > 0 ? candidate : current;

  const recencyPriority = candidate.activityAt - current.activityAt;
  if (recencyPriority !== 0) return recencyPriority > 0 ? candidate : current;

  return candidate.submissionId.localeCompare(current.submissionId) > 0
    ? candidate
    : current;
}

function canonicalizeSkillLabels(skills: string[]) {
  const labels = new Map<string, string>();
  for (const skill of skills) {
    const normalized = humanizeIdentifier(skill);
    const displayName = `${normalized.charAt(0).toLocaleUpperCase()}${normalized.slice(1)}`;
    labels.set(normalized.toLocaleLowerCase(), displayName);
  }
  return [...labels.values()];
}

function pluralize(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function MomentumHighlight({
  student,
  onOpenSubmission,
}: {
  student: StudentMomentum | null;
  onOpenSubmission: (submissionId: Id<"submissions">) => void;
}) {
  if (!student) {
    return (
      <div className={`${PANEL_CLASS} px-5 py-5 sm:px-6`}>
        <p className="text-[13px] font-semibold text-foreground xl:text-sm">Most progress today</p>
        <p className="mt-2 text-[13px] leading-5 text-secondary-foreground xl:text-sm">
          Student momentum will appear after someone starts an assignment today.
        </p>
      </div>
    );
  }

  const progress = percentage(student.answeredCount, student.questionCount);
  const progressDetail =
    student.completedCount > 0
      ? `${pluralize(student.completedCount, "assignment")} completed`
      : `${student.answeredCount}/${student.questionCount} questions answered`;

  return (
    <article className={`${PANEL_CLASS} px-5 py-5 sm:px-6`}>
      <div className="flex items-center gap-2.5 text-primary">
        <HugeiconsIcon icon={CrownIcon} size={18} strokeWidth={1.8} aria-hidden />
        <p className="text-[13px] font-semibold xl:text-sm">Most progress today</p>
      </div>
      <div className="mt-4 grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-secondary-foreground"
        >
          {initials(student.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground xl:text-[17px]">
            {student.name}
          </p>
          <p className="mt-0.5 text-[12.5px] text-secondary-foreground xl:text-[13.5px]">
            {progressDetail}
          </p>
        </div>
        <Button
          aria-label={`View ${student.name}'s latest work`}
          onClick={() => onOpenSubmission(student.latestSubmissionId)}
          size="sm"
          variant="ghost"
        >
          View work
        </Button>
      </div>
      <div
        aria-label={`${student.name} completion progress`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}

function StudentAttentionList({
  students,
  onOpenSubmission,
}: {
  students: StudentAttention[];
  onOpenSubmission: (submissionId: Id<"submissions">) => void;
}) {
  return (
    <div className={PANEL_CLASS}>
      <div className="border-b border-border/80 px-5 py-3.5 sm:px-6">
        <p className="text-[13px] font-semibold text-foreground xl:text-sm">Needs attention</p>
      </div>
      {students.length === 0 ? (
        <p className="px-5 py-5 text-[13px] leading-5 text-secondary-foreground sm:px-6 xl:text-sm">
          No struggling skills or written answers are waiting for follow-up.
        </p>
      ) : (
        <ul className="divide-y divide-border/80">
          {students.map((student) => {
            const actionLabel =
              student.actionableSubmission.pendingReviewCount > 0 ? "Review" : "View";
            return (
              <li
                key={student.key}
                className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 sm:px-6"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-secondary-foreground"
                >
                  {initials(student.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-foreground xl:text-[14.5px]">
                      {student.name}
                    </p>
                    {student.pendingReviewCount > 0 ? (
                      <span className="shrink-0 text-[11.5px] font-medium text-destructive numeric xl:text-[12.5px]">
                        {student.pendingReviewCount} to review
                      </span>
                    ) : null}
                  </div>
                  {student.strugglingSkills.length > 0 ? (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-secondary-foreground xl:text-[13px]">
                      Support with {student.strugglingSkills.join(" · ")}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px] leading-5 text-secondary-foreground xl:text-[13px]">
                      Written responses are ready for teacher review.
                    </p>
                  )}
                </div>
                <Button
                  aria-label={`${actionLabel} ${student.name}'s relevant submission`}
                          onClick={() =>
                    onOpenSubmission(student.actionableSubmission.submissionId)
                  }
                  size="sm"
                  variant="ghost"
                >
                  {actionLabel}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatTile({
  className,
  label,
  value,
  suffix,
  detail,
}: {
  className?: string;
  label: string;
  value: number;
  suffix?: string;
  detail: string;
}) {
  return (
    <div className={`min-w-0 px-5 py-5 sm:px-6 xl:py-6 ${className ?? ""}`}>
      <p className="truncate text-[12px] font-medium text-secondary-foreground xl:text-[13px]">
        {label}
      </p>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="text-[29px] font-semibold leading-none tracking-[-0.04em] numeric xl:text-[33px]">
          {value}
          {suffix ? (
            <span className="ml-0.5 text-[16px] text-secondary-foreground xl:text-[18px]">
              {suffix}
            </span>
          ) : null}
        </p>
        <span className="truncate pb-0.5 text-[11px] text-secondary-foreground xl:text-[12px]">
          {detail}
        </span>
      </div>
    </div>
  );
}

function FeedCard({
  item,
  now,
  onOpen,
}: {
  item: FeedItem;
  now: number;
  onOpen: () => void;
}) {
  const percentage =
    item.maxAutoScore === 0 ? 0 : Math.round(((item.score ?? 0) / item.maxAutoScore) * 100);
  const isSubmitted = item.status === "submitted";

  return (
    <article className="px-4 py-5 transition-colors duration-150 hover:bg-muted/30 sm:px-5 xl:px-6">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_84px] items-start gap-x-3.5 xl:grid-cols-[44px_minmax(0,1fr)_96px] xl:gap-x-4">
        <span className="grid size-9 place-items-center rounded-full bg-muted text-[11px] font-semibold text-secondary-foreground xl:text-[11.5px]">
          {initials(item.studentName)}
        </span>

        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em] xl:text-[15.5px]">
            {item.studentName}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground xl:text-[13.5px]">
            <HomeworkGlyph id={item.assignmentId} size="sm" />
            <span className="truncate">{item.assignmentTitle}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] xl:text-[13px]">
            {isSubmitted ? (
              <>
                <div className="w-28 xl:w-32">
                  <ScoreBar percentage={percentage} />
                </div>
                <span className="font-semibold numeric">
                  {percentage}%
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {item.score}/{item.maxAutoScore}
                  </span>
                </span>
              </>
            ) : (
              <span className="font-semibold text-primary">
                In progress{" "}
                <span className="font-normal text-muted-foreground">
                  · {item.answeredCount}/{item.questionCount} answered
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-muted-foreground numeric">
              <Clock3 size={13} aria-hidden /> {item.activeMinutes} min
            </span>
            {item.lookupCount > 0 ? (
              <span
                className="flex items-center gap-1.5 text-muted-foreground numeric"
                title="Times the student left the tab mid-question"
              >
                <Eye size={13} aria-hidden /> {item.lookupCount} lookups
              </span>
            ) : null}
            {item.pendingReviewCount > 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-destructive">
                <AlertTriangle size={13} aria-hidden /> {item.pendingReviewCount} to review
              </span>
            ) : null}
            {item.feedback ? (
              <span
                className="flex items-center gap-1.5 font-medium text-foreground/72 numeric"
                title={item.feedback.comment ?? "Student homework rating"}
                aria-label={`${item.feedback.rating} out of 5 stars${item.feedback.comment ? `: ${item.feedback.comment}` : ""}`}
              >
                <Star size={13} className="fill-amber-400 text-amber-500" aria-hidden />
                {item.feedback.rating}/5
                {item.feedback.comment ? " · feedback" : ""}
              </span>
            ) : null}
          </div>

          {item.strugglingSkills.length > 0 ? (
            <p className="mt-2.5 text-[12px] leading-5 text-muted-foreground xl:text-[13px]">
              <span className="font-semibold text-destructive">Needs support:</span>{" "}
              {item.strugglingSkills.map(humanizeIdentifier).join(" · ")}
            </p>
          ) : null}

          <SummaryBlock item={item} />
        </div>

        <div className="grid min-w-0 justify-items-end gap-2">
          <time className="truncate text-right text-[11.5px] leading-5 text-muted-foreground numeric xl:text-[12.5px]">
            {formatRelativeTime(item.submittedAt ?? item.startedAt, now)}
          </time>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center px-2"
            onClick={onOpen}
          >
            {item.pendingReviewCount > 0 ? "Review" : "View"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function SummaryBlock({ item }: { item: FeedItem }) {
  const summaryInput = useQuery(
    api.feed.summaryInput,
    item.status === "submitted" && !item.aiSummary
      ? { submissionId: item.submissionId }
      : "skip",
  );
  const attachAiSummary = useMutation(api.submissions.attachAiSummary);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item.aiSummary) {
    return (
      <div className="mt-4 max-w-4xl border-l-2 border-primary/30 pl-4">
        <p
          className={`text-[13px] leading-5 text-foreground/80 xl:text-[14px] xl:leading-6 ${
            isExpanded ? "" : "line-clamp-3"
          }`}
        >
          {item.aiSummary.text}
        </p>
        {item.aiSummary.text.length > 300 ? (
          <button
            type="button"
            className="mt-1 inline-flex min-h-8 items-center text-[12.5px] font-medium text-primary hover:underline xl:text-[13.5px]"
            onClick={() => setIsExpanded((isOpen) => !isOpen)}
          >
            {isExpanded ? "Show less" : "Read summary"}
          </button>
        ) : null}
        {item.aiSummary.focusAreas.length > 0 ? (
          <p className="mt-1.5 text-[12px] leading-5 text-foreground/70 xl:text-[13px]">
            <span className="font-medium text-foreground/75">Next lesson:</span>{" "}
            {item.aiSummary.focusAreas.map(humanizeIdentifier).join(" · ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (item.status !== "submitted") return null;

  async function summarize() {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setError("Summaries need the desktop app.");
      return;
    }
    if (!summaryInput) return;
    setIsSummarizing(true);
    setError(null);
    try {
      const result = await bridge.summarizeSubmission({
        requestId: crypto.randomUUID(),
        ...summaryInput,
      });
      await attachAiSummary({
        submissionId: item.submissionId,
        summary: { ...result.summary, generatedAt: Date.now() },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not summarize.");
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <div className="mt-3 flex min-h-8 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={isSummarizing || summaryInput === undefined}
        onClick={() => void summarize()}
      >
        {isSummarizing ? <Spinner className="size-3.5" /> : null}
        {isSummarizing ? "Reading the answers…" : "Create summary"}
      </Button>
      {error ? <span className="text-[12.5px] text-destructive">{error}</span> : null}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] items-center gap-2 px-6 py-6 text-[13px] text-muted-foreground lg:px-10 xl:py-8 xl:text-[14px]">
      <Spinner /> Loading your day…
    </div>
  );
}
