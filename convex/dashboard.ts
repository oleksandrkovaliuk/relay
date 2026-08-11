import { v } from "convex/values";

import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const MAX_SUBMISSIONS = 300;
const MAX_ANSWERS = 800;
const MAX_QUESTIONS = 40;
const TOP_LIST_SIZE = 6;
const MAX_STUDENTS_PER_SKILL = 6;

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

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function percentage(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
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
  args: {},
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
  handler: async (ctx) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "published"))
      .take(MAX_SUBMISSIONS);
    const students = await ctx.db
      .query("students")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .take(MAX_SUBMISSIONS);
    const submissions = await ctx.db.query("submissions").order("desc").take(MAX_SUBMISSIONS);
    const feedbackItems = await ctx.db
      .query("submissionFeedback")
      .order("desc")
      .take(MAX_SUBMISSIONS);

    const submitted = submissions.filter((submission) => submission.status === "submitted");
    const scored = submitted.filter(
      (submission) => submission.score !== undefined && submission.maxAutoScore > 0,
    );
    const timed = submitted.filter((submission) => (submission.activeMs ?? 0) > 0);

    const buckets = new Map<string, { submitted: number; started: number }>();
    for (const submission of submissions) {
      const startedKey = dayKey(submission.startedAt);
      const startedBucket = buckets.get(startedKey) ?? { submitted: 0, started: 0 };
      startedBucket.started += 1;
      buckets.set(startedKey, startedBucket);
      if (!submission.submittedAt) continue;
      const submittedKey = dayKey(submission.submittedAt);
      const submittedBucket = buckets.get(submittedKey) ?? { submitted: 0, started: 0 };
      submittedBucket.submitted += 1;
      buckets.set(submittedKey, submittedBucket);
    }

    return {
      publishedAssignments: assignments.length,
      activeStudents: students.length,
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
  args: {},
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
  handler: async (ctx) => {
    const answers = await ctx.db.query("answers").order("desc").take(MAX_ANSWERS);
    const questionCache = new Map<Id<"assignmentQuestions">, Doc<"assignmentQuestions"> | null>();
    const submissionCache = new Map<Id<"submissions">, Doc<"submissions"> | null>();
    const studentCache = new Map<Id<"students">, Doc<"students"> | null>();
    const totals = new Map<string, SkillMasteryCounts>();

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

      if (!submissionCache.has(answer.submissionId)) {
        submissionCache.set(
          answer.submissionId,
          await ctx.db.get("submissions", answer.submissionId),
        );
      }
      const submission = submissionCache.get(answer.submissionId);
      if (submission?.studentId && !studentCache.has(submission.studentId)) {
        studentCache.set(
          submission.studentId,
          await ctx.db.get("students", submission.studentId),
        );
      }
      const student = submission?.studentId ? studentCache.get(submission.studentId) : null;

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

    return [...totals.entries()]
      .map(([skill, entry]) => ({
        skill,
        accuracy: percentage(entry.correct, entry.attempts),
        attempts: entry.attempts,
        averageSeconds: Math.round(entry.activeMs / entry.attempts / 1000),
        students: selectBalancedStudentMastery(
          [...entry.students.entries()].map(([studentId, studentEntry]) => ({
            studentId,
            name: studentCache.get(studentId)?.name ?? "Student",
            accuracy: percentage(studentEntry.correct, studentEntry.attempts),
            attempts: studentEntry.attempts,
          })),
        ),
      }))
      .toSorted((left, right) => left.accuracy - right.accuracy);
  },
});

export const questionInsights = query({
  args: {},
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
  handler: async (ctx) => {
    const answers = await ctx.db.query("answers").order("desc").take(MAX_ANSWERS);
    const grouped = new Map<
      Id<"assignmentQuestions">,
      { correct: number; attempts: number; activeMs: number; lookups: number; revisions: number }
    >();
    for (const answer of answers) {
      if (!answer.correctness || answer.correctness === "pending_review") continue;
      const entry =
        grouped.get(answer.questionId) ??
        { correct: 0, attempts: 0, activeMs: 0, lookups: 0, revisions: 0 };
      entry.attempts += 1;
      entry.activeMs += answer.activeMs;
      entry.lookups += answer.lookupCount;
      entry.revisions += answer.revisionCount;
      if (answer.correctness === "correct") entry.correct += 1;
      grouped.set(answer.questionId, entry);
    }

    const insights = [];
    for (const [questionId, entry] of grouped) {
      const question = await ctx.db.get("assignmentQuestions", questionId);
      if (!question) continue;
      const assignment = await ctx.db.get("assignments", question.assignmentId);
      insights.push({
        questionId,
        prompt: question.prompt,
        type: question.type,
        assignmentTitle: assignment?.title ?? "Homework",
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

export const studentPressure = query({
  args: {},
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
  handler: async (ctx) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .take(MAX_QUESTIONS);
    return Promise.all(
      students.map(async (student) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", student._id))
          .order("desc")
          .take(MAX_QUESTIONS);
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
