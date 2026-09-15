import { v } from "convex/values";

import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCurrentUser, requireOwned } from "./auth";

/** Enough to show a pattern, few enough to leave room for the brief itself. */
const MAX_KEPT_EXAMPLES = 3;
const MAX_STYLE_NOTES_LENGTH = 4_000;
const RECENT_ASSIGNMENT_SCAN = 6;

export const styleProfileValidator = v.object({
  /** The teacher's own rules, written once in Settings. */
  styleNotes: v.string(),
  /**
   * What they asked Claude to change about generated activities. Every one of
   * these is a mistake worth not repeating.
   */
  editInstructions: v.array(v.string()),
  /** Prompts from sets they published unchanged — the house style, by example. */
  keptExamples: v.array(v.string()),
});

/**
 * What Relay knows about how this teacher writes homework. It is assembled from
 * their own accepted work rather than from any Claude history: a generation runs
 * in a fresh session with no memory of the last one, so anything that should
 * carry over has to be carried by us.
 */
export const styleProfile = query({
  args: {},
  returns: styleProfileValidator,
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const profile = await ctx.db
      .query("teacherProfile")
      .withIndex("by_ownerId", (query) => query.eq("ownerId", user._id))
      .unique();
    return {
      styleNotes: profile?.styleNotes ?? "",
      editInstructions: profile?.appliedEditInstructions ?? [],
      keptExamples: await recentKeptPrompts(ctx, user._id),
    };
  },
});

export const setStyleNotes = mutation({
  args: { styleNotes: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const styleNotes = args.styleNotes.slice(0, MAX_STYLE_NOTES_LENGTH);
    const existing = await ctx.db
      .query("teacherProfile")
      .withIndex("by_ownerId", (query) => query.eq("ownerId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch("teacherProfile", existing._id, {
        styleNotes,
        updatedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.insert("teacherProfile", {
      ownerId: user._id,
      styleNotes,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Prompts from published sets: homework the teacher was happy to send. */
async function recentKeptPrompts(ctx: QueryCtx, ownerId: Id<"users">) {
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_ownerId_and_status_and_publishedAt", (q) =>
      q.eq("ownerId", ownerId).eq("status", "published"),
    )
    .order("desc")
    .take(RECENT_ASSIGNMENT_SCAN);

  const prompts: string[] = [];
  for (const assignment of assignments) {
    const questions = await ctx.db
      .query("assignmentQuestions")
      .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", assignment._id))
      .take(MAX_KEPT_EXAMPLES);
    for (const question of questions) {
      if (prompts.length >= MAX_KEPT_EXAMPLES) return prompts;
      prompts.push(question.prompt);
    }
  }
  return prompts;
}

export const learnerContext = query({
  args: { studentIds: v.array(v.id("students")) },
  returns: v.object({ studentContext: v.string(), recentPerformance: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const studentIds = [...new Set(args.studentIds)];
    if (studentIds.length > 200) throw new Error("Too many students.");
    const contextBudget = Math.floor(18_000 / Math.max(1, studentIds.length));
    const learners = await Promise.all(studentIds.map(async (studentId, index) => {
      const student = requireOwned(await ctx.db.get("students", studentId), user._id, "Student not found.");
      const submissions = await ctx.db.query("submissions")
        .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", studentId))
        .order("desc").take(6);
      const evidence = submissions.filter((submission) => submission.ownerId === user._id && submission.status === "submitted")
        .slice(0, 3).map((submission) => {
          const score = submission.maxAutoScore > 0 ? `${Math.round((submission.score ?? 0) / submission.maxAutoScore * 100)}% auto-graded` : "Written work; no automatic score";
          return `${score}. ${submission.aiSummary?.text ?? ""} Focus: ${submission.aiSummary?.focusAreas.join(", ") || "No recorded focus areas"}`;
        }).join("\n");
      const label = `Learner ${index + 1}`;
      return {
        context: `${label}: ${student.contextNotes.trim() || "No saved context."}`.slice(0, contextBudget),
        performance: `${label}: ${evidence || "No recent submitted work."}`.slice(0, contextBudget),
      };
    }));
    return { studentContext: learners.map((learner) => learner.context).join("\n\n"), recentPerformance: learners.map((learner) => learner.performance).join("\n\n") };
  },
});
