import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireCurrentUser } from "./auth";
import { aiSummaryValidator } from "./content";
import { loadSubmissionDetail } from "./submissionLib";
import { loadSubmissionFeedback, submissionFeedbackValueValidator } from "./feedback";
import { MAX_QUESTIONS } from "./limits";

const MAX_FEED_ITEMS = 50;
/** The homework page only needs the handful a teacher could actually act on. */
const MAX_IN_PROGRESS_ITEMS = 8;
const STRUGGLE_ACCURACY_THRESHOLD = 0.5;

const feedItemValidator = v.object({
  submissionId: v.id("submissions"),
  assignmentId: v.id("assignments"),
  assignmentTitle: v.string(),
  studentId: v.union(v.id("students"), v.null()),
  studentName: v.string(),
  status: v.union(v.literal("in_progress"), v.literal("submitted")),
  startedAt: v.number(),
  submittedAt: v.optional(v.number()),
  score: v.optional(v.number()),
  maxAutoScore: v.number(),
  answeredCount: v.number(),
  questionCount: v.number(),
  activeMinutes: v.number(),
  lookupCount: v.number(),
  pendingReviewCount: v.number(),
  strugglingSkills: v.array(v.string()),
  aiSummary: v.optional(aiSummaryValidator),
  feedback: v.optional(submissionFeedbackValueValidator),
});

export const inbox = query({
  args: {},
  returns: v.array(feedItemValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_ownerId_and_startedAt", (query) => query.eq("ownerId", user._id))
      .order("desc")
      .take(MAX_FEED_ITEMS);
    return Promise.all(
      submissions.map(async (submission) => {
        const assignment = await ctx.db.get("assignments", submission.assignmentId);
        const questions = await ctx.db
          .query("assignmentQuestions")
          .withIndex("by_assignmentId_and_order", (q) =>
            q.eq("assignmentId", submission.assignmentId),
          )
          .take(MAX_QUESTIONS);
        const answers = await ctx.db
          .query("answers")
          .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
          .take(MAX_QUESTIONS);

        const skillsById = new Map(questions.map((question) => [question._id, question.skillTags]));
        const strugglingSkills = new Set<string>();
        for (const answer of answers) {
          const isGradedMiss =
            answer.correctness === "incorrect" || answer.correctness === "partial";
          if (!isGradedMiss) continue;
          for (const skill of skillsById.get(answer.questionId) ?? []) {
            strugglingSkills.add(skill);
          }
        }
        const activeMs =
          submission.activeMs ?? answers.reduce((total, answer) => total + answer.activeMs, 0);
        const lookupCount =
          submission.lookupCount ??
          answers.reduce((total, answer) => total + answer.lookupCount, 0);
        const feedback = await loadSubmissionFeedback(ctx, submission._id);

        return {
          submissionId: submission._id,
          assignmentId: submission.assignmentId,
          assignmentTitle: assignment?.title ?? "Homework",
          studentId: submission.studentId ?? null,
          studentName: submission.studentName,
          status: submission.status,
          startedAt: submission.startedAt,
          ...(submission.submittedAt ? { submittedAt: submission.submittedAt } : {}),
          ...(submission.score === undefined ? {} : { score: submission.score }),
          maxAutoScore: submission.maxAutoScore,
          answeredCount: answers.length,
          questionCount: questions.length,
          activeMinutes: Math.round(activeMs / 60_000),
          lookupCount,
          pendingReviewCount: submission.pendingReviewCount ?? 0,
          strugglingSkills: [...strugglingSkills].slice(0, 4),
          ...(submission.aiSummary ? { aiSummary: submission.aiSummary } : {}),
          ...(feedback ? { feedback } : {}),
        };
      }),
    );
  },
});

/**
 * Just the attempts a student has open, and how far in they are. The full inbox
 * reads every question and answer of the last fifty submissions to work out
 * struggling skills — far too much to subscribe to from a page that only wants
 * to say "on step 3 of 8".
 */
export const inProgress = query({
  args: {},
  returns: v.array(
    v.object({
      submissionId: v.id("submissions"),
      assignmentId: v.id("assignments"),
      assignmentTitle: v.string(),
      studentName: v.string(),
      startedAt: v.number(),
      answeredCount: v.number(),
      questionCount: v.number(),
      activeMinutes: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_ownerId_and_status_and_submittedAt", (q) =>
        q.eq("ownerId", user._id).eq("status", "in_progress"),
      )
      .order("desc")
      .take(MAX_IN_PROGRESS_ITEMS);

    return Promise.all(
      submissions.map(async (submission) => {
        const assignment = await ctx.db.get("assignments", submission.assignmentId);
        const questions = await ctx.db
          .query("assignmentQuestions")
          .withIndex("by_assignmentId_and_order", (q) =>
            q.eq("assignmentId", submission.assignmentId),
          )
          .take(MAX_QUESTIONS);
        const answers = await ctx.db
          .query("answers")
          .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
          .take(MAX_QUESTIONS);

        return {
          submissionId: submission._id,
          assignmentId: submission.assignmentId,
          assignmentTitle: assignment?.title ?? "Homework",
          studentName: submission.studentName,
          startedAt: submission.startedAt,
          answeredCount: answers.length,
          questionCount: questions.length,
          activeMinutes: Math.round((submission.activeMs ?? 0) / 60_000),
        };
      }),
    );
  },
});

export const awaitingSummary = query({
  args: {},
  returns: v.array(
    v.object({
      submissionId: v.id("submissions"),
      studentName: v.string(),
      assignmentTitle: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_ownerId_and_status_and_submittedAt", (q) =>
        q.eq("ownerId", user._id).eq("status", "submitted"),
      )
      .order("desc")
      .take(MAX_FEED_ITEMS);
    const missing = submissions.filter((submission) => !submission.aiSummary).slice(0, 5);
    return Promise.all(
      missing.map(async (submission) => {
        const assignment = await ctx.db.get("assignments", submission.assignmentId);
        return {
          submissionId: submission._id,
          studentName: submission.studentName,
          assignmentTitle: assignment?.title ?? "Homework",
        };
      }),
    );
  },
});

/** As much evidence as is worth putting in one summary request. */
const MAX_SUMMARY_QUESTIONS = 60;

/**
 * A worksheet can now hold a hundred activities, and a summary of all of them is
 * both slower and worse than a summary of the ones that went wrong. Everything
 * the student did not get plainly right is kept, in order, and the correct ones
 * fill whatever room is left — a set answered perfectly still reads as one.
 */
function selectSummaryEvidence<
  Answer extends { correctness?: string; order: number },
>(answers: Answer[]) {
  if (answers.length <= MAX_SUMMARY_QUESTIONS) return answers;
  const informative = answers.filter((answer) => answer.correctness !== "correct");
  const remainingRoom = Math.max(0, MAX_SUMMARY_QUESTIONS - informative.length);
  const correct = answers
    .filter((answer) => answer.correctness === "correct")
    .slice(0, remainingRoom);
  return [...informative.slice(0, MAX_SUMMARY_QUESTIONS), ...correct].toSorted(
    (left, right) => left.order - right.order,
  );
}

export const summaryInput = query({
  args: { submissionId: v.id("submissions") },
  returns: v.union(
    v.object({
      studentName: v.string(),
      assignmentTitle: v.string(),
      scorePercentage: v.number(),
      activeMinutes: v.number(),
      lookupCount: v.number(),
      questions: v.array(
        v.object({
          prompt: v.string(),
          skillTags: v.array(v.string()),
          correctness: v.string(),
          studentAnswer: v.string(),
          correctAnswer: v.union(v.string(), v.null()),
          activeSeconds: v.number(),
          lookupCount: v.number(),
          revisionCount: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const detail = await loadSubmissionDetail(ctx, args.submissionId, user._id);
    if (!detail) return null;
    return {
      studentName: detail.studentName,
      assignmentTitle: detail.assignmentTitle,
      scorePercentage:
        detail.maxAutoScore === 0
          ? 0
          : Math.round(((detail.score ?? 0) / detail.maxAutoScore) * 100),
      activeMinutes: Math.round(detail.activeMs / 60_000),
      lookupCount: detail.lookupCount,
      questions: selectSummaryEvidence(detail.answers).map((answer) => ({
        prompt: answer.prompt,
        skillTags: answer.skillTags,
        correctness: answer.correctness ?? "unanswered",
        studentAnswer: answer.responseText,
        correctAnswer: answer.correctAnswer,
        activeSeconds: Math.round(answer.activeMs / 1000),
        lookupCount: answer.lookupCount,
        revisionCount: answer.revisionCount,
      })),
    };
  },
});

export const skillPressure = query({
  args: {},
  returns: v.array(
    v.object({ skill: v.string(), accuracy: v.number(), attempts: v.number() }),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_ownerId", (query) => query.eq("ownerId", user._id))
      .order("desc")
      .take(500);
    const totals = new Map<string, { correct: number; attempts: number }>();
    for (const answer of answers) {
      if (!answer.correctness || answer.correctness === "pending_review") continue;
      const question = await ctx.db.get("assignmentQuestions", answer.questionId);
      if (!question) continue;
      for (const skill of question.skillTags) {
        const entry = totals.get(skill) ?? { correct: 0, attempts: 0 };
        entry.attempts += 1;
        if (answer.correctness === "correct") entry.correct += 1;
        totals.set(skill, entry);
      }
    }
    return [...totals.entries()]
      .map(([skill, entry]) => ({
        skill,
        accuracy: Math.round((entry.correct / entry.attempts) * 100),
        attempts: entry.attempts,
      }))
      .filter((entry) => entry.accuracy <= STRUGGLE_ACCURACY_THRESHOLD * 100)
      .toSorted((left, right) => left.accuracy - right.accuracy)
      .slice(0, 6);
  },
});
