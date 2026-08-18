import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { MAX_QUESTIONS } from "./limits";

/**
 * How many submissions one call may clear. Deleting a learner or a whole
 * homework set means deleting every answer underneath it, and a single
 * transaction must not try to carry an unbounded amount of history — so the
 * work is done a page at a time and the caller repeats the mutation until it
 * reports itself finished.
 */
export const MAX_SUBMISSIONS_PER_DELETION = 5;

/** There is one feedback row per submission; a page above that is paranoia. */
const MAX_FEEDBACK_PER_SUBMISSION = 4;

/** An attempt and everything that only exists because of it. */
export async function deleteSubmissionCascade(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
) {
  // One answer row per question, so a page of MAX_QUESTIONS is all of them.
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .take(MAX_QUESTIONS);
  for (const answer of answers) await ctx.db.delete("answers", answer._id);

  const feedback = await ctx.db
    .query("submissionFeedback")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .take(MAX_FEEDBACK_PER_SUBMISSION);
  for (const item of feedback) await ctx.db.delete("submissionFeedback", item._id);

  await ctx.db.delete("submissions", submissionId);
}
