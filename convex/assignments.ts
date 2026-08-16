import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  describeCorrectAnswer,
  publicQuestionContentValidator,
  questionContentValidator,
  toPublicContent,
} from "./content";
import { submissionFeedbackValueValidator } from "./feedback";
import { questionSetValidator, referenceRuleValidator } from "./schema";

const MAX_ASSIGNMENTS = 100;
const MAX_ASSIGNEES = 200;
const MAX_QUESTIONS = 40;
const DRAFT_DISCARD_READ_LIMIT = MAX_QUESTIONS + 1;
const MIN_SHARE_TOKEN_LENGTH = 16;

const homeworkQuestionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("fill_blank"),
  v.literal("matching"),
  v.literal("select_cloze"),
  v.literal("error_fix"),
  v.literal("proofread"),
  v.literal("short_answer"),
  v.literal("rewrite"),
);

const questionDifficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

const assignedStudentValidator = v.object({
  _id: v.id("students"),
  name: v.string(),
});

async function loadAssignedStudents(
  ctx: QueryCtx,
  assignmentId: Id<"assignments">,
  legacyStudentId?: Id<"students">,
) {
  const links = await ctx.db
    .query("assignmentStudents")
    .withIndex("by_assignmentId_and_studentId", (index) =>
      index.eq("assignmentId", assignmentId),
    )
    .take(MAX_ASSIGNEES);
  const studentIds = links.map((link) => link.studentId);
  if (studentIds.length === 0 && legacyStudentId) studentIds.push(legacyStudentId);
  const students = await Promise.all(studentIds.map((studentId) => ctx.db.get("students", studentId)));
  return students
    .filter((student) => student !== null)
    .map((student) => ({ _id: student._id, name: student.name }));
}

async function replaceAssignedStudents(
  ctx: MutationCtx,
  assignmentId: Id<"assignments">,
  studentIds: Id<"students">[],
) {
  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length > MAX_ASSIGNEES) {
    throw new Error(`Homework can be assigned to at most ${MAX_ASSIGNEES} students.`);
  }
  const students = await Promise.all(uniqueStudentIds.map((studentId) => ctx.db.get("students", studentId)));
  if (students.some((student) => !student || student.status !== "active")) {
    throw new Error("One or more selected students are unavailable.");
  }
  const existingLinks = await ctx.db
    .query("assignmentStudents")
    .withIndex("by_assignmentId_and_studentId", (index) =>
      index.eq("assignmentId", assignmentId),
    )
    .take(MAX_ASSIGNEES + 1);
  for (const link of existingLinks) await ctx.db.delete("assignmentStudents", link._id);
  for (const studentId of uniqueStudentIds) {
    await ctx.db.insert("assignmentStudents", { assignmentId, studentId, createdAt: Date.now() });
  }
}

const publicQuestionValidator = v.object({
  _id: v.id("assignmentQuestions"),
  order: v.number(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: publicQuestionContentValidator,
  points: v.number(),
  difficulty: v.string(),
  set: v.optional(questionSetValidator),
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
  set: v.optional(questionSetValidator),
});

export const listPublished = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("assignments"),
      /** Kept so a published set keeps the badge it had as a draft. */
      homeworkDraftId: v.id("homeworkDrafts"),
      title: v.string(),
      summary: v.string(),
      estimatedMinutes: v.number(),
      shareToken: v.string(),
      status: v.union(v.literal("published"), v.literal("closed")),
      publishedAt: v.number(),
      dueAt: v.optional(v.number()),
      studentName: v.union(v.string(), v.null()),
      assignedStudents: v.array(assignedStudentValidator),
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
        const assignedStudents = await loadAssignedStudents(
          ctx,
          assignment._id,
          assignment.studentId,
        );
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
          homeworkDraftId: assignment.homeworkDraftId,
          title: assignment.title,
          summary: assignment.summary,
          estimatedMinutes: assignment.estimatedMinutes,
          shareToken: assignment.shareToken,
          status: assignment.status,
          publishedAt: assignment.publishedAt,
          ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
          studentName: assignedStudents.length === 1 ? assignedStudents[0]!.name : null,
          assignedStudents,
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
      referenceRules: v.array(referenceRuleValidator),
      studentName: v.union(v.string(), v.null()),
      assignedStudents: v.array(assignedStudentValidator),
      publication: v.union(
        v.object({
          assignmentId: v.id("assignments"),
          shareToken: v.string(),
          status: v.union(v.literal("published"), v.literal("closed")),
          dueAt: v.optional(v.number()),
        }),
        v.null(),
      ),
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
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_homeworkDraftId", (index) =>
        index.eq("homeworkDraftId", args.homeworkDraftId),
      )
      .first();
    const assignedStudents = assignment
      ? await loadAssignedStudents(ctx, assignment._id, assignment.studentId)
      : student
        ? [{ _id: student._id, name: student.name }]
        : [];
    return {
      _id: draft._id,
      title: draft.title,
      summary: draft.summary,
      estimatedMinutes: draft.estimatedMinutes,
      learningObjectives: draft.learningObjectives,
      referenceRules: draft.referenceRules ?? [],
      studentName: student?.name ?? null,
      assignedStudents,
      publication: assignment
        ? {
            assignmentId: assignment._id,
            shareToken: assignment.shareToken,
            status: assignment.status,
            ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
          }
        : null,
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
        ...(question.set ? { set: question.set } : {}),
      })),
    };
  },
});

export const publish = mutation({
  args: {
    homeworkDraftId: v.id("homeworkDrafts"),
    shareToken: v.string(),
    dueAt: v.optional(v.number()),
    studentIds: v.optional(v.array(v.id("students"))),
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
    const studentIds = args.studentIds ?? (draft.studentId ? [draft.studentId] : []);

    const assignmentId = await ctx.db.insert("assignments", {
      homeworkDraftId: args.homeworkDraftId,
      ...(studentIds.length === 1 ? { studentId: studentIds[0] } : {}),
      title: draft.title,
      summary: draft.summary,
      estimatedMinutes: draft.estimatedMinutes,
      learningObjectives: draft.learningObjectives,
      ...(draft.referenceRules?.length ? { referenceRules: draft.referenceRules } : {}),
      shareToken: args.shareToken,
      status: "published",
      publishedAt: Date.now(),
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
    });
    await replaceAssignedStudents(ctx, assignmentId, studentIds);
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
        ...(question.set ? { set: question.set } : {}),
      });
    }
    return { assignmentId, shareToken: args.shareToken };
  },
});

export const updateHomework = mutation({
  args: {
    homeworkDraftId: v.id("homeworkDrafts"),
    title: v.string(),
    summary: v.string(),
    questions: v.array(
      v.object({
        questionId: v.id("homeworkQuestions"),
        prompt: v.string(),
        instructions: v.string(),
        explanation: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const summary = args.summary.trim();
    if (!title) throw new Error("Homework needs a title.");
    if (!summary) throw new Error("Homework needs a summary.");
    if (args.questions.length > MAX_QUESTIONS) {
      throw new Error(`Homework may contain at most ${MAX_QUESTIONS} questions.`);
    }

    const draft = await ctx.db.get("homeworkDrafts", args.homeworkDraftId);
    if (!draft) throw new Error("Homework draft not found.");
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_homeworkDraftId", (index) =>
        index.eq("homeworkDraftId", args.homeworkDraftId),
      )
      .first();
    const publishedQuestions = assignment
      ? await ctx.db
          .query("assignmentQuestions")
          .withIndex("by_assignmentId_and_order", (index) =>
            index.eq("assignmentId", assignment._id),
          )
          .take(MAX_QUESTIONS)
      : [];

    await ctx.db.patch("homeworkDrafts", draft._id, { title, summary });
    if (assignment) await ctx.db.patch("assignments", assignment._id, { title, summary });
    for (const questionEdit of args.questions) {
      const question = await ctx.db.get("homeworkQuestions", questionEdit.questionId);
      if (!question || question.homeworkDraftId !== draft._id) {
        throw new Error("A question does not belong to this homework.");
      }
      const fields = {
        prompt: questionEdit.prompt.trim(),
        instructions: questionEdit.instructions.trim(),
        explanation: questionEdit.explanation.trim(),
      };
      if (!fields.prompt || !fields.instructions) {
        throw new Error("Every activity needs a prompt and instructions.");
      }
      await ctx.db.patch("homeworkQuestions", question._id, fields);
      const publishedQuestion = publishedQuestions.find(
        (candidate) => candidate.order === question.order,
      );
      if (publishedQuestion) await ctx.db.patch("assignmentQuestions", publishedQuestion._id, fields);
    }
    return null;
  },
});

export const replaceQuestion = mutation({
  args: {
    questionId: v.id("homeworkQuestions"),
    question: v.object({
      type: homeworkQuestionTypeValidator,
      prompt: v.string(),
      instructions: v.string(),
      content: questionContentValidator,
      skillTags: v.array(v.string()),
      points: v.number(),
      difficulty: questionDifficultyValidator,
      explanation: v.string(),
      set: v.optional(questionSetValidator),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get("homeworkQuestions", args.questionId);
    if (!question) throw new Error("Homework activity not found.");
    if (args.question.skillTags.length < 1 || args.question.skillTags.length > 4) {
      throw new Error("An activity needs between one and four skill tags.");
    }
    if (!Number.isInteger(args.question.points) || args.question.points < 1 || args.question.points > 20) {
      throw new Error("Activity points must be a whole number between 1 and 20.");
    }

    const fields = {
      type: args.question.type,
      prompt: args.question.prompt.trim(),
      instructions: args.question.instructions.trim(),
      content: args.question.content,
      skillTags: args.question.skillTags.map((skillTag) => skillTag.trim()),
      points: args.question.points,
      difficulty: args.question.difficulty,
      explanation: args.question.explanation.trim(),
    };
    if (!fields.prompt || !fields.instructions || !fields.explanation) {
      throw new Error("The revised activity is incomplete.");
    }
    if (fields.skillTags.some((skillTag) => !skillTag)) {
      throw new Error("Activity skill tags cannot be empty.");
    }

    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_homeworkDraftId", (index) =>
        index.eq("homeworkDraftId", question.homeworkDraftId),
      )
      .first();
    const publishedQuestion = assignment
      ? await ctx.db
          .query("assignmentQuestions")
          .withIndex("by_assignmentId_and_order", (index) =>
            index.eq("assignmentId", assignment._id).eq("order", question.order),
          )
          .unique()
      : null;

    await ctx.db.patch("homeworkQuestions", question._id, fields);
    if (publishedQuestion) await ctx.db.patch("assignmentQuestions", publishedQuestion._id, fields);
    return null;
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

export const setAssignees = mutation({
  args: {
    assignmentId: v.id("assignments"),
    studentIds: v.array(v.id("students")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get("assignments", args.assignmentId);
    if (!assignment) throw new Error("Homework assignment not found.");
    await replaceAssignedStudents(ctx, assignment._id, args.studentIds);
    await ctx.db.patch("assignments", assignment._id, {
      studentId: args.studentIds.length === 1 ? args.studentIds[0] : undefined,
    });
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
      referenceRules: v.array(referenceRuleValidator),
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
    const assignedStudents = await loadAssignedStudents(
      ctx,
      assignment._id,
      assignment.studentId,
    );
    return {
      _id: assignment._id,
      title: assignment.title,
      summary: assignment.summary,
      estimatedMinutes: assignment.estimatedMinutes,
      learningObjectives: assignment.learningObjectives,
      referenceRules: assignment.referenceRules ?? [],
      ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
      studentName: assignedStudents.length === 1 ? assignedStudents[0]!.name : null,
      questions: questions.map((question) => ({
        _id: question._id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        content: toPublicContent(question.content),
        points: question.points,
        difficulty: question.difficulty,
        ...(question.set ? { set: question.set } : {}),
      })),
    };
  },
});
