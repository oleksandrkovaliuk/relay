import { v, type Infer } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireCurrentUser, requireOwned } from "./auth";
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
import { calculateSubmissionTotals, loadSubmissionDetail } from "./submissionLib";
import { submissionFeedbackValueValidator } from "./feedback";
import { MAX_ASSIGNEES, MAX_QUESTIONS } from "./limits";

/**
 * One section of a worksheet, which is what the player saves and checks at a
 * time. Above the largest section generation can produce, so a hand-built or
 * legacy set with one long run of activities is still checkable in one go.
 */
const MAX_SECTION_QUESTIONS = 60;
const MIN_RESUME_TOKEN_LENGTH = 16;
const MIN_STUDENT_NAME_LENGTH = 2;

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
      ...(assignment.ownerId ? { ownerId: assignment.ownerId } : {}),
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

const savedAnswerValidator = v.object({
  questionId: v.id("assignmentQuestions"),
  response: answerResponseValidator,
  stats: answerStatsValidator,
});

/** The submission this token opens, or an error. Never another student's. */
async function requireOpenSubmission(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
  resumeToken: string,
) {
  const submission = await ctx.db.get("submissions", submissionId);
  if (!submission || submission.resumeToken !== resumeToken) {
    throw new Error("Invalid submission token.");
  }
  if (submission.status !== "in_progress") throw new Error("Submission is already complete.");
  return submission;
}

async function writeAnswer(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  saved: Infer<typeof savedAnswerValidator>,
) {
  const question = await ctx.db.get("assignmentQuestions", saved.questionId);
  if (!question || question.assignmentId !== submission.assignmentId) {
    throw new Error("Question does not belong to this homework.");
  }

  const existing = await ctx.db
    .query("answers")
    .withIndex("by_submissionId_and_questionId", (q) =>
      q.eq("submissionId", submission._id).eq("questionId", saved.questionId),
    )
    .unique();
  const record = {
    response: saved.response,
    activeMs: Math.round(saved.stats.activeMs),
    lookupCount: saved.stats.lookupCount,
    revisionCount: saved.stats.revisionCount,
    answeredAt: Date.now(),
  };
  if (existing) await ctx.db.patch("answers", existing._id, record);
  else
    await ctx.db.insert("answers", {
      ...(submission.ownerId ? { ownerId: submission.ownerId } : {}),
      submissionId: submission._id,
      questionId: saved.questionId,
      ...record,
    });
}

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
    const submission = await requireOpenSubmission(ctx, args.submissionId, args.resumeToken);
    await writeAnswer(ctx, submission, {
      questionId: args.questionId,
      response: args.response,
      stats: args.stats,
    });
    return null;
  },
});

/**
 * A whole section in one transaction. The student answers a screenful at a time
 * now, so saving it one activity at a time was twenty round trips on every
 * navigation — and a failure halfway through left some answers stored and the
 * rest not, with the player believing it had saved them all.
 */
export const saveSectionAnswers = mutation({
  args: {
    submissionId: v.id("submissions"),
    resumeToken: v.string(),
    answers: v.array(savedAnswerValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.answers.length > MAX_SECTION_QUESTIONS) {
      throw new Error("Save one section at a time.");
    }
    const submission = await requireOpenSubmission(ctx, args.submissionId, args.resumeToken);
    for (const saved of args.answers) await writeAnswer(ctx, submission, saved);
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

    let activeMs = 0;
    let lookupCount = 0;
    for (const answer of answers) {
      const question = await ctx.db.get("assignmentQuestions", answer.questionId);
      if (!question || question.assignmentId !== submission.assignmentId) continue;
      const graded = gradeResponse(question.content, answer.response, question.points);
      activeMs += answer.activeMs;
      lookupCount += answer.lookupCount;
      await ctx.db.patch("answers", answer._id, {
        correctness: graded.correctness,
        pointsAwarded: graded.pointsAwarded,
      });
    }

    /**
     * Totalled from the questions, not from this loop: the loop only sees
     * answers that exist, and the worksheet's own skipped activities have to
     * count against the score. Read after the patches above, so it sees them.
     */
    const totals = await calculateSubmissionTotals(ctx, submission);
    await ctx.db.patch("submissions", submission._id, {
      status: "submitted",
      submittedAt: Date.now(),
      score: totals.score,
      maxAutoScore: totals.maxScore,
      pendingReviewCount: totals.pendingReviewCount,
      activeMs,
      lookupCount,
    });
    return {
      score: totals.score,
      maxAutoScore: totals.maxScore,
      percentage:
        totals.maxScore === 0 ? 0 : Math.round((totals.score / totals.maxScore) * 100),
      pendingReviewCount: totals.pendingReviewCount,
    };
  },
});

/** One verdict inside an activity: a blank, a gap, a pair, a flagged mistake. */
const answerPartValidator = v.object({
  label: v.string(),
  given: v.string(),
  expected: v.string(),
  isCorrect: v.boolean(),
  reason: v.union(v.string(), v.null()),
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
  parts: v.array(answerPartValidator),
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

const sectionCheckStatusValidator = v.union(
  v.literal("correct"),
  v.literal("partial"),
  v.literal("incorrect"),
  /** A written answer: nothing here can be marked without the teacher. */
  v.literal("needs_teacher"),
  v.literal("unanswered"),
);

/**
 * Marks one section mid-homework, without revealing anything. The student asked
 * "did I get these right?", so they are told exactly that and no more: a verdict
 * per activity, a verdict per blank or gap where the widget has several, and the
 * section's score. Nothing is written — this changes no grade and no answer, so a
 * student can check, rework what is red, and check again.
 */
export const checkSection = query({
  args: {
    submissionId: v.id("submissions"),
    resumeToken: v.string(),
    questionIds: v.array(v.id("assignmentQuestions")),
  },
  returns: v.union(
    v.object({
      score: v.number(),
      maxScore: v.number(),
      correctCount: v.number(),
      gradedCount: v.number(),
      items: v.array(
        v.object({
          questionId: v.id("assignmentQuestions"),
          status: sectionCheckStatusValidator,
          /**
           * One entry per blank, gap or pair, in the order the widget draws
           * them. Empty for an activity with a single verdict, and for multiple
           * choice — a per-option verdict there would point straight at the
           * answer the student did not pick.
           */
          parts: v.array(v.boolean()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    if (submission.resumeToken !== args.resumeToken) {
      throw new Error("Invalid submission token.");
    }
    if (args.questionIds.length > MAX_SECTION_QUESTIONS) {
      throw new Error("Check one section at a time.");
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(MAX_QUESTIONS);
    const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    let gradedCount = 0;
    const items: {
      questionId: Id<"assignmentQuestions">;
      status: "correct" | "partial" | "incorrect" | "needs_teacher" | "unanswered";
      parts: boolean[];
    }[] = [];

    for (const questionId of args.questionIds) {
      const question = await ctx.db.get("assignmentQuestions", questionId);
      if (!question || question.assignmentId !== submission.assignmentId) {
        throw new Error("Question does not belong to this homework.");
      }
      const answer = answersByQuestionId.get(questionId);
      if (!isAutoGradable(question.content)) {
        items.push({ questionId, status: "needs_teacher" as const, parts: [] });
        continue;
      }
      if (!answer) {
        maxScore += question.points;
        gradedCount += 1;
        items.push({ questionId, status: "unanswered" as const, parts: [] });
        continue;
      }

      const graded = gradeResponse(question.content, answer.response, question.points);
      score += graded.pointsAwarded;
      maxScore += question.points;
      gradedCount += 1;
      if (graded.correctness === "correct") correctCount += 1;
      const parts =
        question.content.kind === "multiple_choice"
          ? []
          : gradeResponseParts(question.content, answer.response).map((part) => part.isCorrect);
      items.push({
        questionId,
        status: graded.correctness === "pending_review" ? ("needs_teacher" as const) : graded.correctness,
        parts,
      });
    }

    return { score, maxScore, correctCount, gradedCount, items };
  },
});

export const attachAiSummary = mutation({
  args: { submissionId: v.id("submissions"), summary: aiSummaryValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    requireOwned(
      await ctx.db.get("submissions", args.submissionId),
      user._id,
      "Submission not found.",
    );
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
          set: v.optional(questionSetValidator),
          skillTags: v.array(v.string()),
          points: v.number(),
          answered: v.boolean(),
          parts: v.array(answerPartValidator),
          response: v.optional(answerResponseValidator),
          pointsAwarded: v.optional(v.number()),
          correctness: v.optional(correctnessValidator),
          isProvisional: v.boolean(),
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
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return loadSubmissionDetail(ctx, args.submissionId, user._id);
  },
});
