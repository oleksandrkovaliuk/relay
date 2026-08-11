import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  describeCorrectAnswer,
  publicQuestionContentValidator,
  questionContentValidator,
  toPublicContent,
} from "./content";
import { submissionFeedbackValueValidator } from "./feedback";

const MAX_ASSIGNMENTS = 100;
const MAX_QUESTIONS = 40;
const DRAFT_DISCARD_READ_LIMIT = MAX_QUESTIONS + 1;
const MIN_SHARE_TOKEN_LENGTH = 16;

const publicQuestionValidator = v.object({
  _id: v.id("assignmentQuestions"),
  order: v.number(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: publicQuestionContentValidator,
  points: v.number(),
  difficulty: v.string(),
});

const draftQuestionValidator = v.object({
  _id: v.id("homeworkQuestions"),
  order: v.number(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: questionContentValidator,
  skillTags: v.array(v.string()),
  points: v.number(),
  difficulty: v.string(),
  explanation: v.string(),
  correctAnswer: v.union(v.string(), v.null()),
});

export const listPublished = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("assignments"),
      title: v.string(),
      summary: v.string(),
      estimatedMinutes: v.number(),
      shareToken: v.string(),
      status: v.union(v.literal("published"), v.literal("closed")),
      publishedAt: v.number(),
      dueAt: v.optional(v.number()),
      studentName: v.union(v.string(), v.null()),
      questionCount: v.number(),
      submittedCount: v.number(),
      startedCount: v.number(),
      feedbackCount: v.number(),
      averageRating: v.optional(v.number()),
      latestFeedback: v.optional(
        v.object({
          submissionId: v.id("submissions"),
          studentName: v.string(),
          ...submissionFeedbackValueValidator.fields,
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const assignments = await ctx.db.query("assignments").order("desc").take(MAX_ASSIGNMENTS);
    return Promise.all(
      assignments.map(async (assignment) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_assignmentId_and_startedAt", (q) =>
            q.eq("assignmentId", assignment._id),
          )
          .take(MAX_ASSIGNMENTS);
        const questions = await ctx.db
          .query("assignmentQuestions")
          .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", assignment._id))
          .take(MAX_QUESTIONS);
        const feedbackItems = await ctx.db
          .query("submissionFeedback")
          .withIndex("by_assignmentId_and_updatedAt", (index) =>
            index.eq("assignmentId", assignment._id),
          )
          .order("desc")
          .take(MAX_ASSIGNMENTS);
        const student = assignment.studentId
          ? await ctx.db.get("students", assignment.studentId)
          : null;
        const latestFeedback = feedbackItems[0];
        const latestSubmission = latestFeedback
          ? await ctx.db.get("submissions", latestFeedback.submissionId)
          : null;
        const averageRating =
          feedbackItems.length === 0
            ? undefined
            : Math.round(
                (feedbackItems.reduce((total, feedback) => total + feedback.rating, 0) /
                  feedbackItems.length) *
                  10,
              ) / 10;
        return {
          _id: assignment._id,
          title: assignment.title,
          summary: assignment.summary,
          estimatedMinutes: assignment.estimatedMinutes,
          shareToken: assignment.shareToken,
          status: assignment.status,
          publishedAt: assignment.publishedAt,
          ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
          studentName: student?.name ?? null,
          questionCount: questions.length,
          submittedCount: submissions.filter((item) => item.status === "submitted").length,
          startedCount: submissions.length,
          feedbackCount: feedbackItems.length,
          ...(averageRating === undefined ? {} : { averageRating }),
          ...(latestFeedback
            ? {
                latestFeedback: {
                  submissionId: latestFeedback.submissionId,
                  studentName: latestSubmission?.studentName ?? "Student",
                  rating: latestFeedback.rating,
                  ...(latestFeedback.comment ? { comment: latestFeedback.comment } : {}),
                  createdAt: latestFeedback.createdAt,
                  updatedAt: latestFeedback.updatedAt,
                },
              }
            : {}),
        };
      }),
    );
  },
});

export const listDrafts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("homeworkDrafts"),
      title: v.string(),
      summary: v.string(),
      estimatedMinutes: v.number(),
      learningObjectives: v.array(v.string()),
      createdAt: v.number(),
      studentName: v.union(v.string(), v.null()),
      questionCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const drafts = await ctx.db.query("homeworkDrafts").order("desc").take(MAX_ASSIGNMENTS);
    const unpublished = [];
    for (const draft of drafts) {
      const assignment = await ctx.db
        .query("assignments")
        .withIndex("by_homeworkDraftId", (q) => q.eq("homeworkDraftId", draft._id))
        .first();
      if (assignment) continue;
      const questions = await ctx.db
        .query("homeworkQuestions")
        .withIndex("by_homeworkDraftId_and_order", (q) => q.eq("homeworkDraftId", draft._id))
        .take(MAX_QUESTIONS);
      const student = draft.studentId ? await ctx.db.get("students", draft.studentId) : null;
      unpublished.push({
        _id: draft._id,
        title: draft.title,
        summary: draft.summary,
        estimatedMinutes: draft.estimatedMinutes,
        learningObjectives: draft.learningObjectives,
        createdAt: draft.createdAt,
        studentName: student?.name ?? null,
        questionCount: questions.length,
      });
    }
    return unpublished;
  },
});

export const getDraft = query({
  args: { homeworkDraftId: v.id("homeworkDrafts") },
  returns: v.union(
    v.object({
      _id: v.id("homeworkDrafts"),
      title: v.string(),
      summary: v.string(),
      estimatedMinutes: v.number(),
      learningObjectives: v.array(v.string()),
      studentName: v.union(v.string(), v.null()),
      questions: v.array(draftQuestionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get("homeworkDrafts", args.homeworkDraftId);
    if (!draft) return null;
    const questions = await ctx.db
      .query("homeworkQuestions")
      .withIndex("by_homeworkDraftId_and_order", (q) =>
        q.eq("homeworkDraftId", args.homeworkDraftId),
      )
      .take(MAX_QUESTIONS);
    const student = draft.studentId ? await ctx.db.get("students", draft.studentId) : null;
    return {
      _id: draft._id,
      title: draft.title,
      summary: draft.summary,
      estimatedMinutes: draft.estimatedMinutes,
      learningObjectives: draft.learningObjectives,
      studentName: student?.name ?? null,
      questions: questions.map((question) => ({
        _id: question._id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        content: question.content,
        skillTags: question.skillTags,
        points: question.points,
        difficulty: question.difficulty,
        explanation: question.explanation,
        correctAnswer: describeCorrectAnswer(question.content),
      })),
    };
  },
});

export const publish = mutation({
  args: {
    homeworkDraftId: v.id("homeworkDrafts"),
    shareToken: v.string(),
    dueAt: v.optional(v.number()),
  },
  returns: v.object({ assignmentId: v.id("assignments"), shareToken: v.string() }),
  handler: async (ctx, args) => {
    if (args.shareToken.length < MIN_SHARE_TOKEN_LENGTH) {
      throw new Error("Share token is too short.");
    }
    const existingToken = await ctx.db
      .query("assignments")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (existingToken) throw new Error("Share token already exists.");
    const existingAssignment = await ctx.db
      .query("assignments")
      .withIndex("by_homeworkDraftId", (q) => q.eq("homeworkDraftId", args.homeworkDraftId))
      .first();
    if (existingAssignment) throw new Error("Homework draft is already published.");

    const draft = await ctx.db.get("homeworkDrafts", args.homeworkDraftId);
    if (!draft) throw new Error("Homework draft not found.");
    const questions = await ctx.db
      .query("homeworkQuestions")
      .withIndex("by_homeworkDraftId_and_order", (q) =>
        q.eq("homeworkDraftId", args.homeworkDraftId),
      )
      .take(MAX_QUESTIONS);
    if (questions.length === 0) throw new Error("Cannot publish an empty homework.");

    const assignmentId = await ctx.db.insert("assignments", {
      homeworkDraftId: args.homeworkDraftId,
      ...(draft.studentId ? { studentId: draft.studentId } : {}),
      title: draft.title,
      summary: draft.summary,
      estimatedMinutes: draft.estimatedMinutes,
      learningObjectives: draft.learningObjectives,
      shareToken: args.shareToken,
      status: "published",
      publishedAt: Date.now(),
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
    });
    for (const question of questions) {
      await ctx.db.insert("assignmentQuestions", {
        assignmentId,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        content: question.content,
        skillTags: question.skillTags,
        points: question.points,
        difficulty: question.difficulty,
        explanation: question.explanation,
      });
    }
    return { assignmentId, shareToken: args.shareToken };
  },
});

export const discardDraft = mutation({
  args: { homeworkDraftId: v.id("homeworkDrafts") },
  returns: v.object({
    homeworkDraftId: v.id("homeworkDrafts"),
    deletedQuestionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_homeworkDraftId", (q) => q.eq("homeworkDraftId", args.homeworkDraftId))
      .first();
    if (assignment) throw new Error("Published homework drafts cannot be discarded.");

    const draft = await ctx.db.get("homeworkDrafts", args.homeworkDraftId);
    if (!draft) throw new Error("Homework draft not found.");

    const questions = await ctx.db
      .query("homeworkQuestions")
      .withIndex("by_homeworkDraftId_and_order", (q) =>
        q.eq("homeworkDraftId", args.homeworkDraftId),
      )
      .take(DRAFT_DISCARD_READ_LIMIT);
    if (questions.length > MAX_QUESTIONS) {
      throw new Error(`Homework drafts may contain at most ${MAX_QUESTIONS} questions.`);
    }

    for (const question of questions) await ctx.db.delete("homeworkQuestions", question._id);
    await ctx.db.delete("homeworkDrafts", draft._id);

    return {
      homeworkDraftId: draft._id,
      deletedQuestionCount: questions.length,
    };
  },
});

export const close = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("assignments", args.assignmentId, { status: "closed" });
    return null;
  },
});

export const getPublic = query({
  args: { shareToken: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("assignments"),
      title: v.string(),
      summary: v.string(),
      estimatedMinutes: v.number(),
      learningObjectives: v.array(v.string()),
      dueAt: v.optional(v.number()),
      studentName: v.union(v.string(), v.null()),
      questions: v.array(publicQuestionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (!assignment || assignment.status !== "published") return null;
    const questions = await ctx.db
      .query("assignmentQuestions")
      .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", assignment._id))
      .take(MAX_QUESTIONS);
    const student = assignment.studentId
      ? await ctx.db.get("students", assignment.studentId)
      : null;
    return {
      _id: assignment._id,
      title: assignment.title,
      summary: assignment.summary,
      estimatedMinutes: assignment.estimatedMinutes,
      learningObjectives: assignment.learningObjectives,
      ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
      studentName: student?.name ?? null,
      questions: questions.map((question) => ({
        _id: question._id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        content: toPublicContent(question.content),
        points: question.points,
        difficulty: question.difficulty,
      })),
    };
  },
});
