import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  aiSummaryValidator,
  answerResponseValidator,
  answerStatsValidator,
  correctnessValidator,
  describeCorrectAnswer,
  describeResponse,
  gradeResponse,
  gradeResponseParts,
  isAutoGradable,
  publicQuestionContentValidator,
  questionContentValidator,
  toPublicContent,
} from "./content";
import { questionSetValidator, referenceRuleValidator } from "./schema";
import { loadSubmissionDetail } from "./submissionLib";
import { submissionFeedbackValueValidator } from "./feedback";

const MAX_QUESTIONS = 40;
const MAX_ASSIGNEES = 200;
const MIN_RESUME_TOKEN_LENGTH = 16;
const MIN_STUDENT_NAME_LENGTH = 2;

const teacherGradeCorrectnessValidator = v.union(
  v.literal("correct"),
  v.literal("partial"),
  v.literal("incorrect"),
);

type TeacherGradeCorrectness = "correct" | "partial" | "incorrect";

function requireValidTeacherGrade(
  correctness: TeacherGradeCorrectness,
  pointsAwarded: number,
  maximumPoints: number,
) {
  const hasBoundedIntegerPoints =
    Number.isInteger(pointsAwarded) && pointsAwarded >= 0 && pointsAwarded <= maximumPoints;
  if (!hasBoundedIntegerPoints) {
    throw new Error(`Points must be a whole number between 0 and ${maximumPoints}.`);
  }
  if (correctness === "correct" && pointsAwarded !== maximumPoints) {
    throw new Error("A correct answer must receive full credit.");
  }
  if (correctness === "incorrect" && pointsAwarded !== 0) {
    throw new Error("An incorrect answer must receive zero points.");
  }
  if (correctness === "partial" && (pointsAwarded === 0 || pointsAwarded === maximumPoints)) {
    throw new Error("A partly right answer must receive partial credit.");
  }
}

async function calculateReviewedSubmissionTotals(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
) {
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .take(MAX_QUESTIONS);

  let score = 0;
  let maxScore = 0;
  let pendingReviewCount = 0;
  for (const answer of answers) {
    if (!answer.correctness || answer.correctness === "pending_review") {
      pendingReviewCount += 1;
      continue;
    }
    const question = await ctx.db.get("assignmentQuestions", answer.questionId);
    if (!question) continue;
    score += answer.pointsAwarded ?? 0;
    maxScore += question.points;
  }

  return { score, maxScore, pendingReviewCount };
}

export const start = mutation({
  args: {
    shareToken: v.string(),
    resumeToken: v.string(),
    studentName: v.optional(v.string()),
  },
  returns: v.object({
    submissionId: v.id("submissions"),
    studentName: v.string(),
    maxAutoScore: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.resumeToken.length < MIN_RESUME_TOKEN_LENGTH) {
      throw new Error("Resume token is too short.");
    }
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (!assignment || assignment.status !== "published") {
      throw new Error("Homework is unavailable.");
    }

    const legacyStudent = assignment.studentId
      ? await ctx.db.get("students", assignment.studentId)
      : null;
    const requestedStudentName = args.studentName?.trim() ?? "";
    const assigneeLinks = await ctx.db
      .query("assignmentStudents")
      .withIndex("by_assignmentId_and_studentId", (index) =>
        index.eq("assignmentId", assignment._id),
      )
      .take(MAX_ASSIGNEES);
    const assignedStudents = await Promise.all(
      assigneeLinks.map((link) => ctx.db.get("students", link.studentId)),
    );
    const matchedStudent = assignedStudents.find(
      (student) =>
        student?.name.localeCompare(requestedStudentName, undefined, { sensitivity: "base" }) === 0,
    );
    const student = legacyStudent ?? matchedStudent ?? null;
    const studentName = student?.name ?? requestedStudentName;
    if (studentName.length < MIN_STUDENT_NAME_LENGTH) throw new Error("Enter your name.");

    const questions = await ctx.db
      .query("assignmentQuestions")
      .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", assignment._id))
      .take(MAX_QUESTIONS);
    const maxAutoScore = questions
      .filter((question) => isAutoGradable(question.content))
      .reduce((total, question) => total + question.points, 0);

    const submissionId = await ctx.db.insert("submissions", {
      assignmentId: assignment._id,
      ...(student ? { studentId: student._id } : {}),
      studentName,
      resumeToken: args.resumeToken,
      status: "in_progress",
      startedAt: Date.now(),
      maxAutoScore,
    });
    return { submissionId, studentName, maxAutoScore };
  },
});

export const saveAnswer = mutation({
  args: {
    submissionId: v.id("submissions"),
    resumeToken: v.string(),
    questionId: v.id("assignmentQuestions"),
    response: answerResponseValidator,
    stats: answerStatsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission || submission.resumeToken !== args.resumeToken) {
      throw new Error("Invalid submission token.");
    }
    if (submission.status !== "in_progress") throw new Error("Submission is already complete.");
    const question = await ctx.db.get("assignmentQuestions", args.questionId);
    if (!question || question.assignmentId !== submission.assignmentId) {
      throw new Error("Question does not belong to this homework.");
    }

    const existing = await ctx.db
      .query("answers")
      .withIndex("by_submissionId_and_questionId", (q) =>
        q.eq("submissionId", args.submissionId).eq("questionId", args.questionId),
      )
      .unique();
    const record = {
      response: args.response,
      activeMs: Math.round(args.stats.activeMs),
      lookupCount: args.stats.lookupCount,
      revisionCount: args.stats.revisionCount,
      answeredAt: Date.now(),
    };
    if (existing) await ctx.db.patch("answers", existing._id, record);
    else
      await ctx.db.insert("answers", {
        submissionId: args.submissionId,
        questionId: args.questionId,
        ...record,
      });
    return null;
  },
});

export const submit = mutation({
  args: { submissionId: v.id("submissions"), resumeToken: v.string() },
  returns: v.object({
    score: v.number(),
    maxAutoScore: v.number(),
    percentage: v.number(),
    pendingReviewCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission || submission.resumeToken !== args.resumeToken) {
      throw new Error("Invalid submission token.");
    }
    if (submission.status !== "in_progress") throw new Error("Submission is already complete.");

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(MAX_QUESTIONS);

    let score = 0;
    let pendingReviewCount = 0;
    let activeMs = 0;
    let lookupCount = 0;
    for (const answer of answers) {
      const question = await ctx.db.get("assignmentQuestions", answer.questionId);
      if (!question || question.assignmentId !== submission.assignmentId) continue;
      const graded = gradeResponse(question.content, answer.response, question.points);
      if (graded.correctness === "pending_review") pendingReviewCount += 1;
      score += graded.pointsAwarded;
      activeMs += answer.activeMs;
      lookupCount += answer.lookupCount;
      await ctx.db.patch("answers", answer._id, {
        correctness: graded.correctness,
        pointsAwarded: graded.pointsAwarded,
      });
    }

    await ctx.db.patch("submissions", submission._id, {
      status: "submitted",
      submittedAt: Date.now(),
      score,
      pendingReviewCount,
      activeMs,
      lookupCount,
    });
    return {
      score,
      maxAutoScore: submission.maxAutoScore,
      percentage:
        submission.maxAutoScore === 0 ? 0 : Math.round((score / submission.maxAutoScore) * 100),
      pendingReviewCount,
    };
  },
});

const reviewItemValidator = v.object({
  questionId: v.id("assignmentQuestions"),
  order: v.number(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: publicQuestionContentValidator,
  set: v.optional(questionSetValidator),
  points: v.number(),
  pointsAwarded: v.number(),
  /** Absent means the student skipped it entirely. */
  correctness: v.optional(correctnessValidator),
  answered: v.boolean(),
  /** The student's own answer, so the review can re-render the real activity. */
  response: v.optional(answerResponseValidator),
  yourAnswer: v.string(),
  correctAnswer: v.union(v.string(), v.null()),
  /** Why the right answer is right, written for the student. */
  explanation: v.string(),
  /** The order events really happened in, for a tense or sequence question. */
  timeline: v.array(v.string()),
  parts: v.array(
    v.object({
      label: v.string(),
      given: v.string(),
      expected: v.string(),
      isCorrect: v.boolean(),
      reason: v.union(v.string(), v.null()),
    }),
  ),
});

/**
 * What the student sees after submitting: every activity with their own answer,
 * the expected one, and the reason. Reading it needs the resume token, so a share
 * link alone never exposes another student's work or the answer key.
 */
export const review = query({
  args: { submissionId: v.id("submissions"), resumeToken: v.string() },
  returns: v.union(
    v.object({
      assignmentTitle: v.string(),
      studentName: v.string(),
      status: v.union(v.literal("in_progress"), v.literal("submitted")),
      score: v.number(),
      maxAutoScore: v.number(),
      percentage: v.number(),
      pendingReviewCount: v.number(),
      referenceRules: v.array(referenceRuleValidator),
      items: v.array(reviewItemValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    if (submission.resumeToken !== args.resumeToken) {
      throw new Error("Invalid submission token.");
    }

    const assignment = await ctx.db.get("assignments", submission.assignmentId);
    const questions = await ctx.db
      .query("assignmentQuestions")
      .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", submission.assignmentId))
      .order("asc")
      .take(MAX_QUESTIONS);
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(MAX_QUESTIONS);
    const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

    return {
      assignmentTitle: assignment?.title ?? "Homework",
      studentName: submission.studentName,
      status: submission.status,
      score: submission.score ?? 0,
      maxAutoScore: submission.maxAutoScore,
      percentage:
        submission.maxAutoScore === 0
          ? 0
          : Math.round(((submission.score ?? 0) / submission.maxAutoScore) * 100),
      pendingReviewCount: submission.pendingReviewCount ?? 0,
      referenceRules: assignment?.referenceRules ?? [],
      items: questions.map((question) => {
        const answer = answersByQuestionId.get(question._id);
        return {
          questionId: question._id,
          order: question.order,
          type: question.type,
          prompt: question.prompt,
          instructions: question.instructions,
          content: toPublicContent(question.content),
          ...(question.set ? { set: question.set } : {}),
          points: question.points,
          pointsAwarded: answer?.pointsAwarded ?? 0,
          ...(answer?.correctness ? { correctness: answer.correctness } : {}),
          answered: answer !== undefined,
          ...(answer ? { response: answer.response } : {}),
          yourAnswer: answer ? describeResponse(answer.response, question.content) : "",
          correctAnswer: describeCorrectAnswer(question.content),
          explanation: question.explanation,
          timeline:
            question.content.kind === "multiple_choice" ? (question.content.timeline ?? []) : [],
          parts: answer ? gradeResponseParts(question.content, answer.response) : [],
        };
      }),
    };
  },
});

export const gradePendingAnswer = mutation({
  args: {
    submissionId: v.id("submissions"),
    questionId: v.id("assignmentQuestions"),
    correctness: teacherGradeCorrectnessValidator,
    pointsAwarded: v.number(),
  },
  returns: v.object({
    score: v.number(),
    maxScore: v.number(),
    pendingReviewCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "submitted") {
      throw new Error("Only submitted homework can be reviewed.");
    }

    const answer = await ctx.db
      .query("answers")
      .withIndex("by_submissionId_and_questionId", (q) =>
        q.eq("submissionId", args.submissionId).eq("questionId", args.questionId),
      )
      .unique();
    if (!answer) throw new Error("Answer not found.");
    if (answer.correctness !== "pending_review") {
      throw new Error("This answer is no longer awaiting review.");
    }

    const question = await ctx.db.get("assignmentQuestions", args.questionId);
    if (!question || question.assignmentId !== submission.assignmentId) {
      throw new Error("Question does not belong to this submission.");
    }
    if (question.content.kind !== "open_response") {
      throw new Error("Only written answers can be reviewed manually.");
    }
    requireValidTeacherGrade(args.correctness, args.pointsAwarded, question.points);

    await ctx.db.patch("answers", answer._id, {
      correctness: args.correctness,
      pointsAwarded: args.pointsAwarded,
    });
    const totals = await calculateReviewedSubmissionTotals(ctx, submission._id);
    await ctx.db.patch("submissions", submission._id, {
      score: totals.score,
      maxAutoScore: totals.maxScore,
      pendingReviewCount: totals.pendingReviewCount,
    });
    return totals;
  },
});

export const attachAiSummary = mutation({
  args: { submissionId: v.id("submissions"), summary: aiSummaryValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("submissions", args.submissionId, { aiSummary: args.summary });
    return null;
  },
});

export const detail = query({
  args: { submissionId: v.id("submissions") },
  returns: v.union(
    v.object({
      _id: v.id("submissions"),
      assignmentTitle: v.string(),
      studentName: v.string(),
      studentId: v.union(v.id("students"), v.null()),
      status: v.union(v.literal("in_progress"), v.literal("submitted")),
      startedAt: v.number(),
      submittedAt: v.optional(v.number()),
      score: v.optional(v.number()),
      maxAutoScore: v.number(),
      activeMs: v.number(),
      lookupCount: v.number(),
      aiSummary: v.optional(aiSummaryValidator),
      feedback: v.optional(submissionFeedbackValueValidator),
      answers: v.array(
        v.object({
          questionId: v.id("assignmentQuestions"),
          order: v.number(),
          type: v.string(),
          prompt: v.string(),
          instructions: v.string(),
          content: questionContentValidator,
          publicContent: publicQuestionContentValidator,
          skillTags: v.array(v.string()),
          points: v.number(),
          answered: v.boolean(),
          response: v.optional(answerResponseValidator),
          pointsAwarded: v.optional(v.number()),
          correctness: v.optional(correctnessValidator),
          responseText: v.string(),
          correctAnswer: v.union(v.string(), v.null()),
          explanation: v.string(),
          activeMs: v.number(),
          lookupCount: v.number(),
          revisionCount: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => loadSubmissionDetail(ctx, args.submissionId),
});
