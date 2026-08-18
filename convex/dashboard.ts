import { v, type Infer } from "convex/values";

import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./auth";
import { MAX_QUESTIONS } from "./limits";

const MAX_SUBMISSIONS = 300;
const MAX_ANSWERS = 800;
const TOP_LIST_SIZE = 6;
const MAX_STUDENTS_PER_SKILL = 6;
const MAX_HIGHLIGHTS = 6;
const MAX_NAMES_PER_HIGHLIGHT = 3;
/** Enough answers behind a skill to talk about it as a pattern. */
const MIN_ATTEMPTS_FOR_HIGHLIGHT = 2;
const STRONG_ACCURACY = 80;
const WEAK_ACCURACY = 70;
/** A drop this large between the last set and the ones before it is a signal. */
const SLIPPING_DROP_POINTS = 15;
const STALLED_MILLISECONDS = 24 * 60 * 60 * 1_000;
const HESITATION_LOOKUPS = 1;
const HIGHLIGHT_PROMPT_LENGTH = 64;

/**
 * Every insight reads the same slice of work: one student or all of them, over
 * all time or a chosen day or range. Passing the same filter to each query keeps
 * the page coherent — nothing on screen is answering a different question.
 */
export const insightFilterValidator = v.object({
  studentId: v.optional(v.id("students")),
  /** Inclusive lower bound on submission activity. */
  from: v.optional(v.number()),
  /** Inclusive upper bound on submission activity. */
  to: v.optional(v.number()),
});

type InsightFilter = Infer<typeof insightFilterValidator>;

const insightHighlightValidator = v.object({
  key: v.string(),
  kind: v.union(
    v.literal("skill_gap"),
    v.literal("skill_strength"),
    v.literal("pending_review"),
    v.literal("hesitation"),
    v.literal("slipping"),
    v.literal("stalled"),
  ),
  tone: v.union(v.literal("attention"), v.literal("positive"), v.literal("neutral")),
  title: v.string(),
  detail: v.string(),
  /** The one number worth reading at a glance, already formatted. */
  value: v.union(v.string(), v.null()),
  studentId: v.union(v.id("students"), v.null()),
  submissionId: v.union(v.id("submissions"), v.null()),
});

type InsightHighlight = Infer<typeof insightHighlightValidator>;

type MasteryCounts = {
  correct: number;
  attempts: number;
};

type SkillMasteryCounts = MasteryCounts & {
  activeMs: number;
  students: Map<Id<"students">, MasteryCounts>;
};

type StudentMastery = {
  studentId: Id<"students">;
  name: string;
  accuracy: number;
  attempts: number;
};

/** One graded answer with everything an insight needs about its context. */
type GradedAnswer = {
  answer: Doc<"answers">;
  question: Doc<"assignmentQuestions">;
  submission: Doc<"submissions">;
  student: Doc<"students"> | null;
};

/**
 * The calendar day a moment belongs to, in the teacher's own timezone. Bucketing
 * in UTC put a session worked at eleven at night into the next day's column for
 * anyone east of London, and the chart's labels — rendered locally — disagreed
 * with the buckets they sat under.
 */
const MAX_DAY_OFFSET_MINUTES = 14 * 60;

function dayKey(timestamp: number, dayOffsetMinutes: number) {
  return new Date(timestamp - dayOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** `Date.prototype.getTimezoneOffset()` as the client reports it, bounded. */
function readDayOffsetMinutes(dayOffsetMinutes: number | undefined) {
  if (dayOffsetMinutes === undefined || !Number.isFinite(dayOffsetMinutes)) return 0;
  return Math.max(-MAX_DAY_OFFSET_MINUTES, Math.min(MAX_DAY_OFFSET_MINUTES, dayOffsetMinutes));
}

function percentage(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function scorePercentage(submission: Doc<"submissions">) {
  if (submission.score === undefined || submission.maxAutoScore === 0) return null;
  return percentage(submission.score, submission.maxAutoScore);
}

function activityAt(submission: Doc<"submissions">) {
  return submission.submittedAt ?? submission.startedAt;
}

function isWithinFilter(submission: Doc<"submissions">, filter?: InsightFilter) {
  const at = activityAt(submission);
  if (filter?.from !== undefined && at < filter.from) return false;
  if (filter?.to !== undefined && at > filter.to) return false;
  return true;
}

/**
 * The submissions in scope, newest first. A student filter reads the student's
 * own index rather than scanning everyone's work.
 */
async function loadSubmissions(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  filter?: InsightFilter,
) {
  const studentId = filter?.studentId;
  const submissions = studentId
    ? await ctx.db
        .query("submissions")
        .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", studentId))
        .order("desc")
        .take(MAX_SUBMISSIONS)
    : await ctx.db
        .query("submissions")
        .withIndex("by_ownerId_and_startedAt", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(MAX_SUBMISSIONS);
  return submissions.filter(
    (submission) => submission.ownerId === ownerId && isWithinFilter(submission, filter),
  );
}

/** Every graded answer belonging to those submissions, with its question and student. */
async function loadGradedAnswers(ctx: QueryCtx, submissions: Doc<"submissions">[]) {
  const questionCache = new Map<Id<"assignmentQuestions">, Doc<"assignmentQuestions"> | null>();
  const studentCache = new Map<Id<"students">, Doc<"students"> | null>();
  const graded: GradedAnswer[] = [];

  for (const submission of submissions) {
    if (graded.length >= MAX_ANSWERS) break;
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(MAX_QUESTIONS);

    if (submission.studentId && !studentCache.has(submission.studentId)) {
      studentCache.set(submission.studentId, await ctx.db.get("students", submission.studentId));
    }
    const student = submission.studentId
      ? (studentCache.get(submission.studentId) ?? null)
      : null;

    for (const answer of answers) {
      if (!answer.correctness || answer.correctness === "pending_review") continue;
      if (!questionCache.has(answer.questionId)) {
        questionCache.set(
          answer.questionId,
          await ctx.db.get("assignmentQuestions", answer.questionId),
        );
      }
      const question = questionCache.get(answer.questionId);
      if (!question) continue;
      graded.push({ answer, question, submission, student });
    }
  }

  return graded;
}

function compareStrongestStudents(left: StudentMastery, right: StudentMastery) {
  return (
    right.accuracy - left.accuracy ||
    right.attempts - left.attempts ||
    left.name.localeCompare(right.name) ||
    left.studentId.localeCompare(right.studentId)
  );
}

function compareWeakestStudents(left: StudentMastery, right: StudentMastery) {
  return (
    left.accuracy - right.accuracy ||
    right.attempts - left.attempts ||
    left.name.localeCompare(right.name) ||
    left.studentId.localeCompare(right.studentId)
  );
}

function selectBalancedStudentMastery(students: StudentMastery[]) {
  const strongestFirst = students.toSorted(compareStrongestStudents);
  if (strongestFirst.length <= MAX_STUDENTS_PER_SKILL) return strongestFirst;

  const studentsPerSide = Math.floor(MAX_STUDENTS_PER_SKILL / 2);
  const strongest = strongestFirst.slice(0, studentsPerSide);
  const selectedStudentIds = new Set(strongest.map((student) => student.studentId));
  const weakest = students
    .toSorted(compareWeakestStudents)
    .filter((student) => !selectedStudentIds.has(student.studentId))
    .slice(0, MAX_STUDENTS_PER_SKILL - strongest.length);
  return [...strongest, ...weakest];
}

export const overview = query({
  args: {
    filter: v.optional(insightFilterValidator),
    /** The client's `getTimezoneOffset()`, so days break where the teacher is. */
    dayOffsetMinutes: v.optional(v.number()),
  },
  returns: v.object({
    publishedAssignments: v.number(),
    activeStudents: v.number(),
    submittedCount: v.number(),
    inProgressCount: v.number(),
    completionRate: v.number(),
    averageScore: v.number(),
    averageMinutes: v.number(),
    ratingCount: v.number(),
    averageRating: v.number(),
    daily: v.array(
      v.object({ date: v.string(), submitted: v.number(), started: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const assignments = (
      await ctx.db
        .query("assignments")
        .withIndex("by_ownerId_and_status_and_publishedAt", (q) =>
          q.eq("ownerId", user._id).eq("status", "published"),
        )
        .take(MAX_SUBMISSIONS)
    ).filter((assignment) => {
      if (args.filter?.studentId && assignment.studentId !== args.filter.studentId) return false;
      if (args.filter?.from !== undefined && assignment.publishedAt < args.filter.from) {
        return false;
      }
      if (args.filter?.to !== undefined && assignment.publishedAt > args.filter.to) return false;
      return true;
    });
    const students = await ctx.db
      .query("students")
      .withIndex("by_ownerId_and_status_and_createdAt", (q) =>
        q.eq("ownerId", user._id).eq("status", "active"),
      )
      .take(MAX_SUBMISSIONS);
    const submissions = await loadSubmissions(ctx, user._id, args.filter);
    const submissionIds = new Set(submissions.map((submission) => submission._id));
    const feedbackItems = (
      await ctx.db.query("submissionFeedback").order("desc").take(MAX_SUBMISSIONS)
    ).filter((feedback) => submissionIds.has(feedback.submissionId));

    const submitted = submissions.filter((submission) => submission.status === "submitted");
    const scored = submitted.filter(
      (submission) => submission.score !== undefined && submission.maxAutoScore > 0,
    );
    const timed = submitted.filter((submission) => (submission.activeMs ?? 0) > 0);

    const dayOffsetMinutes = readDayOffsetMinutes(args.dayOffsetMinutes);
    const buckets = new Map<string, { submitted: number; started: number }>();
    for (const submission of submissions) {
      const startedKey = dayKey(submission.startedAt, dayOffsetMinutes);
      const startedBucket = buckets.get(startedKey) ?? { submitted: 0, started: 0 };
      startedBucket.started += 1;
      buckets.set(startedKey, startedBucket);
      if (!submission.submittedAt) continue;
      const submittedKey = dayKey(submission.submittedAt, dayOffsetMinutes);
      const submittedBucket = buckets.get(submittedKey) ?? { submitted: 0, started: 0 };
      submittedBucket.submitted += 1;
      buckets.set(submittedKey, submittedBucket);
    }

    return {
      publishedAssignments: assignments.length,
      activeStudents: args.filter?.studentId ? 1 : students.length,
      submittedCount: submitted.length,
      inProgressCount: submissions.length - submitted.length,
      completionRate: percentage(submitted.length, submissions.length),
      averageScore:
        scored.length === 0
          ? 0
          : Math.round(
              scored.reduce(
                (total, submission) =>
                  total + ((submission.score ?? 0) / submission.maxAutoScore) * 100,
                0,
              ) / scored.length,
            ),
      averageMinutes:
        timed.length === 0
          ? 0
          : Math.round(
              timed.reduce((total, submission) => total + (submission.activeMs ?? 0), 0) /
                timed.length /
                60_000,
            ),
      ratingCount: feedbackItems.length,
      averageRating:
        feedbackItems.length === 0
          ? 0
          : Math.round(
              (feedbackItems.reduce((total, feedback) => total + feedback.rating, 0) /
                feedbackItems.length) *
                10,
            ) / 10,
      daily: [...buckets.entries()]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .slice(-14)
        .map(([date, counts]) => ({ date, ...counts })),
    };
  },
});

export const skillMastery = query({
  args: { filter: v.optional(insightFilterValidator) },
  returns: v.array(
    v.object({
      skill: v.string(),
      accuracy: v.number(),
      attempts: v.number(),
      averageSeconds: v.number(),
      students: v.array(
        v.object({
          studentId: v.id("students"),
          name: v.string(),
          accuracy: v.number(),
          attempts: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const graded = await loadGradedAnswers(
      ctx,
      await loadSubmissions(ctx, user._id, args.filter),
    );
    const totals = collectSkillTotals(graded);
    const studentNames = new Map(
      graded
        .filter((row): row is GradedAnswer & { student: Doc<"students"> } => row.student !== null)
        .map((row) => [row.student._id, row.student.name]),
    );

    return [...totals.entries()]
      .map(([skill, entry]) => ({
        skill,
        accuracy: percentage(entry.correct, entry.attempts),
        attempts: entry.attempts,
        averageSeconds: Math.round(entry.activeMs / entry.attempts / 1000),
        students: selectBalancedStudentMastery(
          [...entry.students.entries()].map(([studentId, studentEntry]) => ({
            studentId,
            name: studentNames.get(studentId) ?? "Student",
            accuracy: percentage(studentEntry.correct, studentEntry.attempts),
            attempts: studentEntry.attempts,
          })),
        ),
      }))
      .toSorted((left, right) => left.accuracy - right.accuracy);
  },
});

function collectSkillTotals(graded: GradedAnswer[]) {
  const totals = new Map<string, SkillMasteryCounts>();
  for (const { answer, question, student } of graded) {
    for (const skill of question.skillTags) {
      const entry = totals.get(skill) ?? {
        correct: 0,
        attempts: 0,
        activeMs: 0,
        students: new Map<Id<"students">, MasteryCounts>(),
      };
      entry.attempts += 1;
      entry.activeMs += answer.activeMs;
      if (answer.correctness === "correct") entry.correct += 1;

      if (student) {
        const studentEntry = entry.students.get(student._id) ?? { correct: 0, attempts: 0 };
        studentEntry.attempts += 1;
        if (answer.correctness === "correct") studentEntry.correct += 1;
        entry.students.set(student._id, studentEntry);
      }
      totals.set(skill, entry);
    }
  }
  return totals;
}

export const questionInsights = query({
  args: { filter: v.optional(insightFilterValidator) },
  returns: v.array(
    v.object({
      questionId: v.id("assignmentQuestions"),
      prompt: v.string(),
      type: v.string(),
      assignmentTitle: v.string(),
      attempts: v.number(),
      accuracy: v.number(),
      averageSeconds: v.number(),
      averageLookups: v.number(),
      averageRevisions: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const graded = await loadGradedAnswers(
      ctx,
      await loadSubmissions(ctx, user._id, args.filter),
    );
    const titleCache = new Map<Id<"assignments">, string>();
    const insights = [];

    for (const [questionId, entry] of collectQuestionTotals(graded)) {
      if (!titleCache.has(entry.question.assignmentId)) {
        const assignment = await ctx.db.get("assignments", entry.question.assignmentId);
        titleCache.set(entry.question.assignmentId, assignment?.title ?? "Homework");
      }
      insights.push({
        questionId,
        prompt: entry.question.prompt,
        type: entry.question.type,
        assignmentTitle: titleCache.get(entry.question.assignmentId) ?? "Homework",
        attempts: entry.attempts,
        accuracy: percentage(entry.correct, entry.attempts),
        averageSeconds: Math.round(entry.activeMs / entry.attempts / 1000),
        averageLookups: Math.round((entry.lookups / entry.attempts) * 10) / 10,
        averageRevisions: Math.round((entry.revisions / entry.attempts) * 10) / 10,
      });
    }

    return insights
      .toSorted((left, right) => left.accuracy - right.accuracy)
      .slice(0, TOP_LIST_SIZE);
  },
});

type QuestionTotals = {
  question: Doc<"assignmentQuestions">;
  correct: number;
  attempts: number;
  activeMs: number;
  lookups: number;
  revisions: number;
};

function collectQuestionTotals(graded: GradedAnswer[]) {
  const grouped = new Map<Id<"assignmentQuestions">, QuestionTotals>();
  for (const { answer, question } of graded) {
    const entry =
      grouped.get(answer.questionId) ??
      { question, correct: 0, attempts: 0, activeMs: 0, lookups: 0, revisions: 0 };
    entry.attempts += 1;
    entry.activeMs += answer.activeMs;
    entry.lookups += answer.lookupCount;
    entry.revisions += answer.revisionCount;
    if (answer.correctness === "correct") entry.correct += 1;
    grouped.set(answer.questionId, entry);
  }
  return grouped;
}

export const studentPressure = query({
  args: { filter: v.optional(insightFilterValidator) },
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      name: v.string(),
      submittedCount: v.number(),
      averageScore: v.number(),
      lastActivityAt: v.union(v.number(), v.null()),
      openCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const students = (
      await ctx.db
        .query("students")
        .withIndex("by_ownerId_and_status_and_createdAt", (q) =>
          q.eq("ownerId", user._id).eq("status", "active"),
        )
        .take(MAX_QUESTIONS)
    ).filter((student) => !args.filter?.studentId || student._id === args.filter.studentId);

    return Promise.all(
      students.map(async (student) => {
        const submissions = (
          await ctx.db
            .query("submissions")
            .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", student._id))
            .order("desc")
            .take(MAX_QUESTIONS)
        ).filter((submission) => isWithinFilter(submission, args.filter));
        const submitted = submissions.filter((submission) => submission.status === "submitted");
        const scored = submitted.filter(
          (submission) => submission.score !== undefined && submission.maxAutoScore > 0,
        );
        return {
          studentId: student._id,
          name: student.name,
          submittedCount: submitted.length,
          averageScore:
            scored.length === 0
              ? 0
              : Math.round(
                  scored.reduce(
                    (total, submission) =>
                      total + ((submission.score ?? 0) / submission.maxAutoScore) * 100,
                    0,
                  ) / scored.length,
                ),
          lastActivityAt: submissions[0]?.startedAt ?? null,
          openCount: submissions.length - submitted.length,
        };
      }),
    );
  },
});

/**
 * The findings themselves, in plain language and ranked by what deserves a
 * teacher's attention first. Which findings exist depends entirely on what the
 * work shows, so an empty list means there is genuinely nothing to act on.
 */
export const highlights = query({
  args: { filter: v.optional(insightFilterValidator), now: v.number() },
  returns: v.array(insightHighlightValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const submissions = await loadSubmissions(ctx, user._id, args.filter);
    const graded = await loadGradedAnswers(ctx, submissions);
    const studentNames = new Map<Id<"students">, string>();
    for (const { student } of graded) {
      if (student) studentNames.set(student._id, student.name);
    }

    const findings = [
      ...describeSkillFindings(graded, studentNames),
      ...describePendingReview(submissions),
      ...describeStalledWork(submissions, args.now),
      ...describeSlippingStudents(submissions),
      ...describeHesitation(graded),
    ];

    return findings.toSorted(compareHighlights).slice(0, MAX_HIGHLIGHTS);
  },
});

const TONE_RANK: Record<InsightHighlight["tone"], number> = {
  attention: 0,
  neutral: 1,
  positive: 2,
};

function compareHighlights(left: InsightHighlight, right: InsightHighlight) {
  return TONE_RANK[left.tone] - TONE_RANK[right.tone] || left.key.localeCompare(right.key);
}

function describeSkillFindings(
  graded: GradedAnswer[],
  studentNames: Map<Id<"students">, string>,
): InsightHighlight[] {
  const measured = [...collectSkillTotals(graded).entries()]
    .filter(([, entry]) => entry.attempts >= MIN_ATTEMPTS_FOR_HIGHLIGHT)
    .map(([skill, entry]) => ({
      skill,
      accuracy: percentage(entry.correct, entry.attempts),
      attempts: entry.attempts,
      studentIds: [...entry.students.keys()],
    }));
  if (measured.length === 0) return [];

  const findings: InsightHighlight[] = [];
  const weakest = measured.toSorted((left, right) => left.accuracy - right.accuracy)[0];
  if (weakest && weakest.accuracy < WEAK_ACCURACY) {
    findings.push({
      key: `1-skill-gap-${weakest.skill}`,
      kind: "skill_gap",
      tone: "attention",
      title: `${humanizeSkill(weakest.skill)} needs another pass`,
      detail: `${weakest.accuracy}% correct across ${countLabel(weakest.attempts, "graded answer")}${describeNames(weakest.studentIds, studentNames)}.`,
      value: `${weakest.accuracy}%`,
      studentId: weakest.studentIds.length === 1 ? (weakest.studentIds[0] ?? null) : null,
      submissionId: null,
    });
  }

  const strongest = measured.toSorted((left, right) => right.accuracy - left.accuracy)[0];
  if (strongest && strongest.accuracy >= STRONG_ACCURACY && strongest.skill !== weakest?.skill) {
    findings.push({
      key: `5-skill-strength-${strongest.skill}`,
      kind: "skill_strength",
      tone: "positive",
      title: `${humanizeSkill(strongest.skill)} is secure`,
      detail: `${strongest.accuracy}% correct across ${countLabel(strongest.attempts, "graded answer")} — safe to stop drilling.`,
      value: `${strongest.accuracy}%`,
      studentId: strongest.studentIds.length === 1 ? (strongest.studentIds[0] ?? null) : null,
      submissionId: null,
    });
  }

  return findings;
}

function describePendingReview(submissions: Doc<"submissions">[]): InsightHighlight[] {
  const waiting = submissions.filter((submission) => (submission.pendingReviewCount ?? 0) > 0);
  if (waiting.length === 0) return [];

  const total = waiting.reduce(
    (count, submission) => count + (submission.pendingReviewCount ?? 0),
    0,
  );
  const mostWaiting = waiting.toSorted(
    (left, right) => (right.pendingReviewCount ?? 0) - (left.pendingReviewCount ?? 0),
  )[0];
  return [
    {
      key: "0-pending-review",
      kind: "pending_review",
      tone: "attention",
      title: `${countLabel(total, "written answer")} to read`,
      detail: `Across ${countLabel(waiting.length, "submission")} from ${listNames(waiting.map((submission) => submission.studentName))}. Writing is never scored — it is where the next lesson comes from.`,
      value: String(total),
      studentId: mostWaiting?.studentId ?? null,
      submissionId: mostWaiting?._id ?? null,
    },
  ];
}

function describeStalledWork(
  submissions: Doc<"submissions">[],
  now: number,
): InsightHighlight[] {
  const stalled = submissions.filter(
    (submission) =>
      submission.status === "in_progress" && now - submission.startedAt > STALLED_MILLISECONDS,
  );
  if (stalled.length === 0) return [];

  return [
    {
      key: "2-stalled",
      kind: "stalled",
      tone: "attention",
      title: `${countLabel(stalled.length, "set")} started but never finished`,
      detail: `${listNames(stalled.map((submission) => submission.studentName))} opened homework over a day ago and stopped partway.`,
      value: String(stalled.length),
      studentId: stalled[0]?.studentId ?? null,
      submissionId: stalled[0]?._id ?? null,
    },
  ];
}

function describeSlippingStudents(submissions: Doc<"submissions">[]): InsightHighlight[] {
  const byStudent = new Map<Id<"students">, Doc<"submissions">[]>();
  for (const submission of submissions) {
    if (submission.status !== "submitted" || !submission.studentId) continue;
    byStudent.set(submission.studentId, [
      ...(byStudent.get(submission.studentId) ?? []),
      submission,
    ]);
  }

  const findings: InsightHighlight[] = [];
  for (const [studentId, studentSubmissions] of byStudent) {
    // Newest first, so the head is the latest attempt and the tail is the past.
    const scored = studentSubmissions
      .toSorted((left, right) => activityAt(right) - activityAt(left))
      .flatMap((submission) => {
        const score = scorePercentage(submission);
        return score === null ? [] : [{ submission, score }];
      });
    const [latest, ...earlier] = scored;
    if (!latest || earlier.length === 0) continue;

    const earlierAverage = Math.round(
      earlier.reduce((total, entry) => total + entry.score, 0) / earlier.length,
    );
    if (earlierAverage - latest.score < SLIPPING_DROP_POINTS) continue;

    findings.push({
      key: `3-slipping-${studentId}`,
      kind: "slipping",
      tone: "attention",
      title: `${latest.submission.studentName} slipped to ${latest.score}%`,
      detail: `Down from a ${earlierAverage}% average over ${countLabel(earlier.length, "earlier set")}. Worth checking what changed.`,
      value: `−${earlierAverage - latest.score} pts`,
      studentId,
      submissionId: latest.submission._id,
    });
  }
  return findings;
}

function describeHesitation(graded: GradedAnswer[]): InsightHighlight[] {
  const questions = [...collectQuestionTotals(graded).values()]
    .filter((entry) => entry.attempts > 0)
    .map((entry) => ({
      question: entry.question,
      lookups: Math.round((entry.lookups / entry.attempts) * 10) / 10,
      seconds: Math.round(entry.activeMs / entry.attempts / 1000),
    }))
    .toSorted((left, right) => right.lookups - left.lookups);

  const worst = questions[0];
  if (!worst || worst.lookups < HESITATION_LOOKUPS) return [];

  return [
    {
      key: "4-hesitation",
      kind: "hesitation",
      tone: "neutral",
      title: "One question sends students looking things up",
      detail: `“${truncate(worst.question.prompt)}” averages ${worst.lookups} lookups and ${worst.seconds}s per attempt.`,
      value: `${worst.lookups}×`,
      studentId: null,
      submissionId: null,
    },
  ];
}

function humanizeSkill(skill: string) {
  const spaced = skill.replaceAll("_", " ").replaceAll("-", " ").trim();
  return spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function listNames(names: string[]) {
  const unique = [...new Set(names)];
  const shown = unique.slice(0, MAX_NAMES_PER_HIGHLIGHT);
  const remaining = unique.length - shown.length;
  return remaining > 0 ? `${shown.join(", ")} and ${remaining} more` : shown.join(", ");
}

function describeNames(
  studentIds: Id<"students">[],
  studentNames: Map<Id<"students">, string>,
) {
  const names = studentIds.flatMap((studentId) => {
    const name = studentNames.get(studentId);
    return name ? [name] : [];
  });
  return names.length === 0 ? "" : ` — ${listNames(names)}`;
}

function truncate(text: string) {
  const collapsed = text.replaceAll(/\s+/g, " ").trim();
  return collapsed.length <= HIGHLIGHT_PROMPT_LENGTH
    ? collapsed
    : `${collapsed.slice(0, HIGHLIGHT_PROMPT_LENGTH).trimEnd()}…`;
}
