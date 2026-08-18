import { v } from "convex/values";

import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./auth";

/** Enough to show a pattern, few enough to leave room for the brief itself. */
const MAX_EDIT_INSTRUCTIONS = 8;
const MAX_KEPT_EXAMPLES = 3;
const MAX_STYLE_NOTES_LENGTH = 4_000;
const RECENT_JOB_SCAN = 40;
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
      editInstructions: await recentEditInstructions(ctx, user._id),
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

/**
 * The instructions typed into "Ask Claude", newest first. The teacher wrote
 * these to correct an activity, so they read as standing preferences: "make the
 * distractors plausible", "shorter sentences", "use their own errors".
 */
async function recentEditInstructions(ctx: QueryCtx, ownerId: Id<"users">) {
  const jobs = await ctx.db
    .query("aiJobs")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", ownerId))
    .order("desc")
    .take(RECENT_JOB_SCAN);
  const instructions: string[] = [];
  for (const job of jobs) {
    if (job.kind !== "question_rewrite") continue;
    const instruction = job.title.trim();
    // Near-duplicates say nothing extra and crowd out older, different asks.
    if (!instruction || instructions.some((seen) => seen.toLowerCase() === instruction.toLowerCase())) {
      continue;
    }
    instructions.push(instruction);
    if (instructions.length >= MAX_EDIT_INSTRUCTIONS) break;
  }
  return instructions;
}

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
