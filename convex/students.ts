import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { loadSubmissionFeedback, submissionFeedbackValueValidator } from "./feedback";

const MAX_STUDENTS = 200;
const MAX_HISTORY_PER_STUDENT = 20;

const studentValidator = v.object({
  _id: v.id("students"),
  _creationTime: v.number(),
  name: v.string(),
  email: v.optional(v.string()),
  miroBoardUrl: v.optional(v.string()),
  contextNotes: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
});

function requireName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Student name is too short.");
  return trimmed;
}

function requireMiroBoardUrl(miroBoardUrl: string | undefined) {
  const trimmed = miroBoardUrl?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("https://miro.com/")) {
    throw new Error("Miro board URL must start with https://miro.com/.");
  }
  return trimmed;
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      ...studentValidator.fields,
      assignmentCount: v.number(),
      submittedCount: v.number(),
      averageScore: v.optional(v.number()),
      lastActivityAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .order("desc")
      .take(MAX_STUDENTS);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .take(MAX_STUDENTS);

    return Promise.all(
      students.map(async (student) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", student._id))
          .order("desc")
          .take(MAX_HISTORY_PER_STUDENT);
        const scored = submissions.filter(
          (submission) => submission.score !== undefined && submission.maxAutoScore > 0,
        );
        const averageScore =
          scored.length === 0
            ? undefined
            : Math.round(
                scored.reduce(
                  (total, submission) =>
                    total + ((submission.score ?? 0) / submission.maxAutoScore) * 100,
                  0,
                ) / scored.length,
              );
        return {
          ...student,
          assignmentCount: assignments.filter(
            (assignment) => assignment.studentId === student._id,
          ).length,
          submittedCount: submissions.filter(
            (submission) => submission.status === "submitted",
          ).length,
          ...(averageScore === undefined ? {} : { averageScore }),
          ...(submissions[0] ? { lastActivityAt: submissions[0].startedAt } : {}),
        };
      }),
    );
  },
});

export const get = query({
  args: { studentId: v.id("students") },
  returns: v.union(studentValidator, v.null()),
  handler: async (ctx, args) => ctx.db.get("students", args.studentId),
});

export const history = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      submissionId: v.id("submissions"),
      assignmentTitle: v.string(),
      status: v.union(v.literal("in_progress"), v.literal("submitted")),
      startedAt: v.number(),
      submittedAt: v.optional(v.number()),
      score: v.optional(v.number()),
      maxAutoScore: v.number(),
      summaryText: v.optional(v.string()),
      focusAreas: v.array(v.string()),
      feedback: v.optional(submissionFeedbackValueValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(MAX_HISTORY_PER_STUDENT);

    return Promise.all(
      submissions.map(async (submission) => {
        const assignment = await ctx.db.get("assignments", submission.assignmentId);
        const feedback = await loadSubmissionFeedback(ctx, submission._id);
        return {
          submissionId: submission._id,
          assignmentTitle: assignment?.title ?? "Homework",
          status: submission.status,
          startedAt: submission.startedAt,
          ...(submission.submittedAt ? { submittedAt: submission.submittedAt } : {}),
          ...(submission.score === undefined ? {} : { score: submission.score }),
          maxAutoScore: submission.maxAutoScore,
          ...(submission.aiSummary ? { summaryText: submission.aiSummary.text } : {}),
          focusAreas: submission.aiSummary?.focusAreas ?? [],
          ...(feedback ? { feedback } : {}),
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    miroBoardUrl: v.optional(v.string()),
    contextNotes: v.string(),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const miroBoardUrl = requireMiroBoardUrl(args.miroBoardUrl);
    const email = args.email?.trim();
    return ctx.db.insert("students", {
      name: requireName(args.name),
      ...(email ? { email } : {}),
      ...(miroBoardUrl ? { miroBoardUrl } : {}),
      contextNotes: args.contextNotes.trim(),
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    studentId: v.id("students"),
    name: v.string(),
    email: v.optional(v.string()),
    miroBoardUrl: v.optional(v.string()),
    contextNotes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found.");
    const miroBoardUrl = requireMiroBoardUrl(args.miroBoardUrl);
    const email = args.email?.trim();
    await ctx.db.replace("students", args.studentId, {
      name: requireName(args.name),
      ...(email ? { email } : {}),
      ...(miroBoardUrl ? { miroBoardUrl } : {}),
      contextNotes: args.contextNotes.trim(),
      status: student.status,
      createdAt: student.createdAt,
    });
    return null;
  },
});

export const archive = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("students", args.studentId, { status: "archived" });
    return null;
  },
});
