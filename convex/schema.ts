import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  aiSummaryValidator,
  answerResponseValidator,
  correctnessValidator,
  questionContentValidator,
} from "./content";

export const aiJobActivityValidator = v.object({
  kind: v.string(),
  label: v.string(),
  detail: v.optional(v.string()),
  at: v.number(),
});

const questionFields = {
  order: v.number(),
  type: v.string(),
  prompt: v.string(),
  instructions: v.string(),
  content: questionContentValidator,
  skillTags: v.array(v.string()),
  points: v.number(),
  difficulty: v.string(),
  explanation: v.string(),
};

export default defineSchema({
  students: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    miroBoardUrl: v.optional(v.string()),
    contextNotes: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
  }).index("by_status_and_createdAt", ["status", "createdAt"]),

  aiJobs: defineTable({
    requestId: v.string(),
    kind: v.literal("homework_generation"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    studentId: v.optional(v.id("students")),
    title: v.string(),
    inputSnapshot: v.string(),
    provider: v.literal("claude_code"),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    /**
     * The most recent runtime step, mirrored from the desktop process so any
     * screen can show what a long generation is actually doing.
     */
    latestActivity: v.optional(aiJobActivityValidator),
    activityCount: v.optional(v.number()),
  })
    .index("by_requestId", ["requestId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  homeworkDrafts: defineTable({
    aiJobId: v.id("aiJobs"),
    studentId: v.optional(v.id("students")),
    title: v.string(),
    summary: v.string(),
    estimatedMinutes: v.number(),
    learningObjectives: v.array(v.string()),
    status: v.literal("review_required"),
    createdAt: v.number(),
  }).index("by_aiJobId", ["aiJobId"]),

  homeworkQuestions: defineTable({
    homeworkDraftId: v.id("homeworkDrafts"),
    ...questionFields,
  }).index("by_homeworkDraftId_and_order", ["homeworkDraftId", "order"]),

  assignments: defineTable({
    homeworkDraftId: v.id("homeworkDrafts"),
    studentId: v.optional(v.id("students")),
    title: v.string(),
    summary: v.string(),
    estimatedMinutes: v.number(),
    learningObjectives: v.array(v.string()),
    shareToken: v.string(),
    status: v.union(v.literal("published"), v.literal("closed")),
    publishedAt: v.number(),
    dueAt: v.optional(v.number()),
  })
    .index("by_homeworkDraftId", ["homeworkDraftId"])
    .index("by_shareToken", ["shareToken"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"]),

  assignmentQuestions: defineTable({
    assignmentId: v.id("assignments"),
    ...questionFields,
  }).index("by_assignmentId_and_order", ["assignmentId", "order"]),

  submissions: defineTable({
    assignmentId: v.id("assignments"),
    studentId: v.optional(v.id("students")),
    studentName: v.string(),
    resumeToken: v.string(),
    status: v.union(v.literal("in_progress"), v.literal("submitted")),
    startedAt: v.number(),
    submittedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    maxAutoScore: v.number(),
    pendingReviewCount: v.optional(v.number()),
    activeMs: v.optional(v.number()),
    lookupCount: v.optional(v.number()),
    aiSummary: v.optional(aiSummaryValidator),
  })
    .index("by_assignmentId_and_startedAt", ["assignmentId", "startedAt"])
    .index("by_resumeToken", ["resumeToken"])
    .index("by_studentId_and_startedAt", ["studentId", "startedAt"])
    .index("by_status_and_submittedAt", ["status", "submittedAt"]),

  submissionFeedback: defineTable({
    submissionId: v.id("submissions"),
    assignmentId: v.id("assignments"),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_assignmentId_and_updatedAt", ["assignmentId", "updatedAt"]),

  answers: defineTable({
    submissionId: v.id("submissions"),
    questionId: v.id("assignmentQuestions"),
    response: answerResponseValidator,
    correctness: v.optional(correctnessValidator),
    pointsAwarded: v.optional(v.number()),
    activeMs: v.number(),
    lookupCount: v.number(),
    revisionCount: v.number(),
    answeredAt: v.number(),
  })
    .index("by_submissionId_and_questionId", ["submissionId", "questionId"])
    .index("by_submissionId", ["submissionId"]),
});
