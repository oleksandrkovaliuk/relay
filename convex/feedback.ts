import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";

const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_COMMENT_LENGTH = 500;

export const submissionFeedbackValueValidator = v.object({
  rating: v.number(),
  comment: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function requireValidRating(rating: number) {
  const isValidRating =
    Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
  if (!isValidRating) throw new Error("Rating must be a whole number between 1 and 5.");
  return rating;
}

function normalizeComment(comment: string | undefined) {
  const normalized = comment?.trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Feedback must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
  }
  return normalized;
}

function toFeedbackValue(feedback: Doc<"submissionFeedback">) {
  return {
    rating: feedback.rating,
    ...(feedback.comment ? { comment: feedback.comment } : {}),
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

async function requireOwnedSubmission(
  ctx: QueryCtx,
  submissionId: Id<"submissions">,
  resumeToken: string,
) {
  const submission = await ctx.db.get("submissions", submissionId);
  if (!submission || submission.resumeToken !== resumeToken) {
    throw new Error("Invalid submission token.");
  }
  return submission;
}

export async function loadSubmissionFeedback(
  ctx: QueryCtx,
  submissionId: Id<"submissions">,
) {
  const feedback = await ctx.db
    .query("submissionFeedback")
    .withIndex("by_submissionId", (index) => index.eq("submissionId", submissionId))
    .unique();
  return feedback ? toFeedbackValue(feedback) : null;
}

export const save = mutation({
  args: {
    submissionId: v.id("submissions"),
    resumeToken: v.string(),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  returns: submissionFeedbackValueValidator,
  handler: async (ctx, args) => {
    const submission = await requireOwnedSubmission(ctx, args.submissionId, args.resumeToken);
    if (submission.status !== "submitted") {
      throw new Error("Feedback can only be added after homework is submitted.");
    }

    const rating = requireValidRating(args.rating);
    const comment = normalizeComment(args.comment);
    const existing = await ctx.db
      .query("submissionFeedback")
      .withIndex("by_submissionId", (index) =>
        index.eq("submissionId", submission._id),
      )
      .unique();

    const hasSameContent =
      existing?.rating === rating && (existing.comment ?? undefined) === comment;
    if (existing && hasSameContent) return toFeedbackValue(existing);

    const updatedAt = Date.now();
    const createdAt = existing?.createdAt ?? updatedAt;
    const replacement = {
      submissionId: submission._id,
      assignmentId: submission.assignmentId,
      rating,
      ...(comment ? { comment } : {}),
      createdAt,
      updatedAt,
    };
    if (existing) await ctx.db.replace("submissionFeedback", existing._id, replacement);
    else await ctx.db.insert("submissionFeedback", replacement);

    return { rating, ...(comment ? { comment } : {}), createdAt, updatedAt };
  },
});

export const getMine = query({
  args: { submissionId: v.id("submissions"), resumeToken: v.string() },
  returns: v.union(submissionFeedbackValueValidator, v.null()),
  handler: async (ctx, args) => {
    const submission = await requireOwnedSubmission(ctx, args.submissionId, args.resumeToken);
    return loadSubmissionFeedback(ctx, submission._id);
  },
});
