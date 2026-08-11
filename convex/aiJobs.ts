import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { questionContentValidator } from "./content";
import { aiJobActivityValidator } from "./schema";

const draftQuestionValidator = v.object({
  id: v.string(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: questionContentValidator,
  skillTags: v.array(v.string()),
  points: v.number(),
  difficulty: v.string(),
  explanation: v.string(),
});

const homeworkDraftValidator = v.object({
  title: v.string(),
  summary: v.string(),
  estimatedMinutes: v.number(),
  learningObjectives: v.array(v.string()),
  questions: v.array(draftQuestionValidator),
});

export const createHomeworkGeneration = mutation({
  args: {
    requestId: v.string(),
    title: v.string(),
    studentId: v.optional(v.id("students")),
    inputSnapshot: v.string(),
  },
  returns: v.id("aiJobs"),
  handler: async (ctx, args) => {
    const existingJob = await ctx.db
      .query("aiJobs")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (existingJob) throw new Error(`AI job ${args.requestId} already exists.`);

    return ctx.db.insert("aiJobs", {
      requestId: args.requestId,
      kind: "homework_generation",
      status: "pending",
      ...(args.studentId ? { studentId: args.studentId } : {}),
      title: args.title,
      inputSnapshot: args.inputSnapshot,
      provider: "claude_code",
      createdAt: Date.now(),
    });
  },
});

export const markRunning = mutation({
  args: { aiJobId: v.id("aiJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const aiJob = await ctx.db.get("aiJobs", args.aiJobId);
    if (!aiJob) throw new Error("AI job not found.");
    if (aiJob.status !== "pending") throw new Error(`Cannot start a ${aiJob.status} AI job.`);

    await ctx.db.patch("aiJobs", args.aiJobId, { status: "running", startedAt: Date.now() });
    return null;
  },
});

/**
 * Mirrors one runtime step from the desktop process. Deliberately forgiving:
 * progress reporting must never break a generation that is already finishing.
 */
export const recordProgress = mutation({
  args: {
    aiJobId: v.id("aiJobs"),
    activity: aiJobActivityValidator,
    activityCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const aiJob = await ctx.db.get("aiJobs", args.aiJobId);
    if (!aiJob) return null;
    if (aiJob.status !== "pending" && aiJob.status !== "running") return null;

    await ctx.db.patch("aiJobs", args.aiJobId, {
      latestActivity: args.activity,
      activityCount: args.activityCount,
    });
    return null;
  },
});

export const completeHomeworkGeneration = mutation({
  args: { aiJobId: v.id("aiJobs"), draft: homeworkDraftValidator },
  returns: v.id("homeworkDrafts"),
  handler: async (ctx, args) => {
    const aiJob = await ctx.db.get("aiJobs", args.aiJobId);
    if (!aiJob) throw new Error("AI job not found.");
    if (aiJob.status !== "running") throw new Error(`Cannot complete a ${aiJob.status} AI job.`);

    const createdAt = Date.now();
    const homeworkDraftId = await ctx.db.insert("homeworkDrafts", {
      aiJobId: args.aiJobId,
      ...(aiJob.studentId ? { studentId: aiJob.studentId } : {}),
      title: args.draft.title,
      summary: args.draft.summary,
      estimatedMinutes: args.draft.estimatedMinutes,
      learningObjectives: args.draft.learningObjectives,
      status: "review_required",
      createdAt,
    });

    for (const [order, question] of args.draft.questions.entries()) {
      await ctx.db.insert("homeworkQuestions", {
        homeworkDraftId,
        order,
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

    await ctx.db.patch("aiJobs", args.aiJobId, { status: "completed", completedAt: createdAt });
    return homeworkDraftId;
  },
});

export const finishWithError = mutation({
  args: {
    aiJobId: v.id("aiJobs"),
    status: v.union(v.literal("failed"), v.literal("cancelled")),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const aiJob = await ctx.db.get("aiJobs", args.aiJobId);
    if (!aiJob) throw new Error("AI job not found.");
    if (aiJob.status === "completed") throw new Error("A completed AI job cannot be failed.");

    await ctx.db.patch("aiJobs", args.aiJobId, {
      status: args.status,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
    return null;
  },
});

const MAX_ACTIVE_JOBS = 20;

/**
 * Generation runs on the teacher's machine but is recorded here, so the
 * homework page can show what is still being written even after the teacher
 * navigates away from the builder.
 */
export const listActive = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiJobs"),
      title: v.string(),
      status: v.union(v.literal("pending"), v.literal("running")),
      studentName: v.union(v.string(), v.null()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      latestActivity: v.optional(aiJobActivityValidator),
      activityCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("aiJobs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(MAX_ACTIVE_JOBS);
    const running = await ctx.db
      .query("aiJobs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "running"))
      .order("desc")
      .take(MAX_ACTIVE_JOBS);

    const active = [...running, ...pending]
      .toSorted((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_ACTIVE_JOBS);

    return Promise.all(
      active.map(async (job) => {
        const student = job.studentId ? await ctx.db.get("students", job.studentId) : null;
        return {
          _id: job._id,
          title: job.title,
          status: job.status === "running" ? ("running" as const) : ("pending" as const),
          studentName: student?.name ?? null,
          createdAt: job.createdAt,
          ...(job.startedAt === undefined ? {} : { startedAt: job.startedAt }),
          ...(job.latestActivity ? { latestActivity: job.latestActivity } : {}),
          ...(job.activityCount === undefined ? {} : { activityCount: job.activityCount }),
        };
      }),
    );
  },
});

export const listRecent = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiJobs"),
      title: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const jobs = await ctx.db.query("aiJobs").order("desc").take(10);
    return jobs.map((job) => ({
      _id: job._id,
      title: job.title,
      status: job.status,
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
      createdAt: job.createdAt,
    }));
  },
});
