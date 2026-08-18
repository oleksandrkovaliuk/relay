import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireCurrentUser } from "./auth";

const userValueValidator = v.object({
  _id: v.id("users"),
  email: v.union(v.string(), v.null()),
  name: v.union(v.string(), v.null()),
  pictureUrl: v.union(v.string(), v.null()),
});

export const ensureCurrent = mutation({
  args: {},
  returns: userValueValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (query) =>
        query.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const now = Date.now();
    const profile = {
      subject: identity.subject,
      ...(identity.email ? { email: identity.email } : {}),
      ...(identity.name ? { name: identity.name } : {}),
      ...(identity.pictureUrl ? { pictureUrl: identity.pictureUrl } : {}),
      lastSeenAt: now,
    };
    const isFirstUser = !existing && (await ctx.db.query("users").first()) === null;
    let userId: Id<"users">;
    if (existing) {
      await ctx.db.patch("users", existing._id, profile);
      userId = existing._id;
    } else {
      userId = await ctx.db.insert("users", {
          tokenIdentifier: identity.tokenIdentifier,
          ...profile,
          createdAt: now,
        });
    }
    if (isFirstUser) {
      await ctx.scheduler.runAfter(0, internal.users.claimLegacyData, { ownerId: userId });
    }
    return {
      _id: userId,
      email: identity.email ?? null,
      name: identity.name ?? null,
      pictureUrl: identity.pictureUrl ?? null,
    };
  },
});

export const current = query({
  args: {},
  returns: userValueValidator,
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      pictureUrl: user.pictureUrl ?? null,
    };
  },
});

export const claimLegacyData = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get("users", args.ownerId))) return null;
    const hasMore = await claimLegacyBatch(ctx, args.ownerId);
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.users.claimLegacyData, { ownerId: args.ownerId });
    }
    return null;
  },
});

async function claimLegacyBatch(ctx: MutationCtx, ownerId: Id<"users">) {
  const unownedTeacherProfiles = await ctx.db
    .query("teacherProfile")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedStudents = await ctx.db
    .query("students")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedAiJobs = await ctx.db
    .query("aiJobs")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedHomeworkDrafts = await ctx.db
    .query("homeworkDrafts")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedHomeworkQuestions = await ctx.db
    .query("homeworkQuestions")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedAssignments = await ctx.db
    .query("assignments")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedAssignmentStudents = await ctx.db
    .query("assignmentStudents")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedAssignmentQuestions = await ctx.db
    .query("assignmentQuestions")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedSubmissions = await ctx.db
    .query("submissions")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedFeedback = await ctx.db
    .query("submissionFeedback")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);
  const unownedAnswers = await ctx.db
    .query("answers")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", undefined))
    .take(20);

  for (const row of unownedTeacherProfiles) await ctx.db.patch("teacherProfile", row._id, { ownerId });
  for (const row of unownedStudents) await ctx.db.patch("students", row._id, { ownerId });
  for (const row of unownedAiJobs) await ctx.db.patch("aiJobs", row._id, { ownerId });
  for (const row of unownedHomeworkDrafts) await ctx.db.patch("homeworkDrafts", row._id, { ownerId });
  for (const row of unownedHomeworkQuestions) await ctx.db.patch("homeworkQuestions", row._id, { ownerId });
  for (const row of unownedAssignments) await ctx.db.patch("assignments", row._id, { ownerId });
  for (const row of unownedAssignmentStudents) await ctx.db.patch("assignmentStudents", row._id, { ownerId });
  for (const row of unownedAssignmentQuestions) await ctx.db.patch("assignmentQuestions", row._id, { ownerId });
  for (const row of unownedSubmissions) await ctx.db.patch("submissions", row._id, { ownerId });
  for (const row of unownedFeedback) await ctx.db.patch("submissionFeedback", row._id, { ownerId });
  for (const row of unownedAnswers) await ctx.db.patch("answers", row._id, { ownerId });

  return [
    unownedTeacherProfiles,
    unownedStudents,
    unownedAiJobs,
    unownedHomeworkDrafts,
    unownedHomeworkQuestions,
    unownedAssignments,
    unownedAssignmentStudents,
    unownedAssignmentQuestions,
    unownedSubmissions,
    unownedFeedback,
    unownedAnswers,
  ].some((rows) => rows.length === 20);
}
