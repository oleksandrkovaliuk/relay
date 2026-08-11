import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const WIPE_BATCH_SIZE = 500;

const WIPEABLE_TABLES = [
  "aiJobs",
  "homeworkDrafts",
  "homeworkQuestions",
  "students",
  "assignments",
  "assignmentQuestions",
  "submissions",
  "submissionFeedback",
  "answers",
] as const;

export const wipeAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const table of WIPEABLE_TABLES) {
      const rows = await ctx.db.query(table).take(WIPE_BATCH_SIZE);
      for (const row of rows) await ctx.db.delete(table, row._id);
    }
    return null;
  },
});
