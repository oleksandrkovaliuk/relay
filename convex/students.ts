import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser, requireOwned } from "./auth";
import { deleteSubmissionCascade, MAX_SUBMISSIONS_PER_DELETION } from "./deletion";
import { loadSubmissionFeedback, submissionFeedbackValueValidator } from "./feedback";

const MAX_STUDENTS = 200;
const MAX_HISTORY_PER_STUDENT = 20;
/** Assignment links one student can hold. */
const MAX_ASSIGNMENT_LINKS = 200;
/** Rows scanned when unlinking a deleted student from the teacher's own work. */
const MAX_LINKED_ROWS = 400;

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

function toStudentValue(student: Doc<"students">) {
  return {
    _id: student._id,
    _creationTime: student._creationTime,
    name: student.name,
    ...(student.email ? { email: student.email } : {}),
    ...(student.miroBoardUrl ? { miroBoardUrl: student.miroBoardUrl } : {}),
    contextNotes: student.contextNotes,
    status: student.status,
    createdAt: student.createdAt,
  };
}

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
    const user = await requireCurrentUser(ctx);
    const students = await ctx.db
      .query("students")
      .withIndex("by_ownerId_and_status_and_createdAt", (q) =>
        q.eq("ownerId", user._id).eq("status", "active"),
      )
      .order("desc")
      .take(MAX_STUDENTS);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_ownerId_and_status_and_publishedAt", (q) =>
        q.eq("ownerId", user._id).eq("status", "published"),
      )
      .order("desc")
      .take(MAX_STUDENTS);

    return Promise.all(
      students.map(async (student) => {
        const assignmentLinks = await ctx.db
          .query("assignmentStudents")
          .withIndex("by_studentId_and_assignmentId", (index) =>
            index.eq("studentId", student._id),
          )
          .take(MAX_STUDENTS);
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
          ...toStudentValue(student),
          assignmentCount: new Set([
            ...assignmentLinks.map((link) => link.assignmentId),
            ...assignments
              .filter((assignment) => assignment.studentId === student._id)
              .map((assignment) => assignment._id),
          ]).size,
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
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const student = await ctx.db.get("students", args.studentId);
    return student?.ownerId === user._id ? toStudentValue(student) : null;
  },
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
    const user = await requireCurrentUser(ctx);
    requireOwned(await ctx.db.get("students", args.studentId), user._id, "Student not found.");
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(MAX_HISTORY_PER_STUDENT);

    return Promise.all(
      submissions.filter((submission) => submission.ownerId === user._id).map(async (submission) => {
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
    const user = await requireCurrentUser(ctx);
    const miroBoardUrl = requireMiroBoardUrl(args.miroBoardUrl);
    const email = args.email?.trim();
    return ctx.db.insert("students", {
      ownerId: user._id,
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
    const user = await requireCurrentUser(ctx);
    const student = requireOwned(
      await ctx.db.get("students", args.studentId),
      user._id,
      "Student not found.",
    );
    const miroBoardUrl = requireMiroBoardUrl(args.miroBoardUrl);
    const email = args.email?.trim();
    await ctx.db.replace("students", args.studentId, {
      ownerId: user._id,
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

/**
 * Deletes a learner and everything that was only ever about them: their
 * attempts, the answers inside those attempts, their feedback, and the links
 * that assigned homework to them. The homework itself is the teacher's own
 * material and survives — a set was always reusable, and losing it because a
 * student left would be losing the wrong thing.
 *
 * History can be long, so the work is bounded and the mutation says whether it
 * finished. The caller repeats it until it has: the student row is deleted last,
 * so an interrupted delete leaves a student who is still there to try again.
 */
export const remove = mutation({
  args: { studentId: v.id("students") },
  returns: v.object({
    isComplete: v.boolean(),
    deletedSubmissionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const student = requireOwned(
      await ctx.db.get("students", args.studentId),
      user._id,
      "Student not found.",
    );

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_studentId_and_startedAt", (q) => q.eq("studentId", student._id))
      .take(MAX_SUBMISSIONS_PER_DELETION);
    for (const submission of submissions) await deleteSubmissionCascade(ctx, submission._id);
    if (submissions.length === MAX_SUBMISSIONS_PER_DELETION) {
      return { isComplete: false, deletedSubmissionCount: submissions.length };
    }

    const links = await ctx.db
      .query("assignmentStudents")
      .withIndex("by_studentId_and_assignmentId", (q) => q.eq("studentId", student._id))
      .take(MAX_ASSIGNMENT_LINKS);
    for (const link of links) await ctx.db.delete("assignmentStudents", link._id);

    /**
     * Anything that merely names them stops naming them. A dangling id is worse
     * than an unnamed row: publishing a draft whose student no longer exists
     * fails on an assignee it cannot load.
     */
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(MAX_LINKED_ROWS);
    for (const assignment of assignments) {
      if (assignment.studentId !== student._id) continue;
      await ctx.db.patch("assignments", assignment._id, { studentId: undefined });
    }
    const drafts = await ctx.db
      .query("homeworkDrafts")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(MAX_LINKED_ROWS);
    for (const draft of drafts) {
      if (draft.studentId !== student._id) continue;
      await ctx.db.patch("homeworkDrafts", draft._id, { studentId: undefined });
    }
    const jobs = await ctx.db
      .query("aiJobs")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(MAX_LINKED_ROWS);
    for (const job of jobs) {
      if (job.studentId !== student._id) continue;
      await ctx.db.patch("aiJobs", job._id, { studentId: undefined });
    }

    await ctx.db.delete("students", student._id);
    return { isComplete: true, deletedSubmissionCount: submissions.length };
  },
});

export const archive = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    requireOwned(await ctx.db.get("students", args.studentId), user._id, "Student not found.");
    await ctx.db.patch("students", args.studentId, { status: "archived" });
    return null;
  },
});
