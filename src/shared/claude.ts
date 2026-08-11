import { z } from "zod";

const nonEmptyString = z.string().min(1);

export const questionContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("multiple_choice"),
    choices: z.array(nonEmptyString).min(2).max(6),
    correctChoice: z.number().int().min(0).max(5),
  }),
  z.object({
    kind: z.literal("fill_blank"),
    text: nonEmptyString,
    blanks: z.array(z.object({ acceptedAnswers: z.array(nonEmptyString).min(1).max(4) })).min(1).max(10),
  }),
  z.object({
    kind: z.literal("matching"),
    pairs: z.array(z.object({ left: nonEmptyString, right: nonEmptyString })).min(3).max(8),
  }),
  z.object({
    kind: z.literal("open_response"),
    expectedAnswer: nonEmptyString.optional(),
  }),
]);

/**
 * The activity types a homework set can contain. This is the teacher-facing
 * vocabulary as well as the generator's, so a picker in the builder and the
 * prompt rules can never drift apart.
 */
export const ACTIVITY_TYPES = [
  "multiple_choice",
  "fill_blank",
  "matching",
  "short_answer",
  "rewrite",
] as const;

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

export const homeworkQuestionSchema = z.object({
  id: nonEmptyString,
  type: activityTypeSchema,
  prompt: nonEmptyString,
  instructions: nonEmptyString,
  content: questionContentSchema,
  skillTags: z.array(nonEmptyString).min(1).max(4),
  points: z.number().int().min(1).max(20),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: nonEmptyString,
});

export const homeworkDraftSchema = z.object({
  title: nonEmptyString,
  summary: nonEmptyString,
  estimatedMinutes: z.number().int().min(5).max(180),
  learningObjectives: z.array(nonEmptyString).min(1).max(6),
  questions: z.array(homeworkQuestionSchema).min(1).max(20),
});

export const generateHomeworkInputSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    studentName: z.string().max(200).optional(),
    studentContext: z.string().max(20_000).optional(),
    recentPerformance: z.string().max(20_000).optional(),
    lessonNotes: z.string().max(100_000),
    miroBoardUrl: z.string().startsWith("https://miro.com/").optional(),
    targetSkills: z.array(nonEmptyString).max(20),
    durationMinutes: z.number().int().min(5).max(180),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    /** Empty means "any" — the generator picks the mix itself. */
    activityTypes: z.array(activityTypeSchema).max(ACTIVITY_TYPES.length).default([]),
  })
  .refine(
    (input) =>
      input.lessonNotes.trim().length > 0 ||
      Boolean(input.miroBoardUrl) ||
      Boolean(input.studentContext?.trim()),
    { message: "Add lesson notes, student context, or a Miro board.", path: ["lessonNotes"] },
  );

export const summarizeSubmissionInputSchema = z.object({
  requestId: z.string().min(1).max(128),
  studentName: z.string().min(1).max(200),
  assignmentTitle: z.string().min(1).max(300),
  scorePercentage: z.number().min(0).max(100),
  activeMinutes: z.number().min(0),
  lookupCount: z.number().min(0),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1),
        skillTags: z.array(z.string()),
        correctness: z.string(),
        studentAnswer: z.string(),
        correctAnswer: z.string().nullable(),
        activeSeconds: z.number(),
        lookupCount: z.number(),
        revisionCount: z.number(),
      }),
    )
    .max(40),
});

export const submissionSummarySchema = z.object({
  text: z.string().min(1).max(600),
  strengths: z.array(nonEmptyString).max(3),
  focusAreas: z.array(nonEmptyString).max(3),
});

export const claudeAvailabilitySchema = z.object({
  isInstalled: z.boolean(),
  isAuthenticated: z.boolean(),
  executablePath: z.string().nullable(),
  version: z.string().nullable(),
  problem: z.string().nullable(),
});

export const claudeGenerationResultSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  draft: homeworkDraftSchema,
  durationMilliseconds: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});

export const claudeSummaryResultSchema = z.object({
  requestId: z.string(),
  summary: submissionSummarySchema,
});

export const claudeRuntimeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), requestId: z.string() }),
  z.object({ type: z.literal("text_delta"), requestId: z.string(), text: z.string() }),
  z.object({ type: z.literal("tool_started"), requestId: z.string(), toolName: z.string() }),
  z.object({
    type: z.literal("authentication_required"),
    requestId: z.string(),
    provider: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal("completed"), requestId: z.string() }),
  z.object({ type: z.literal("cancelled"), requestId: z.string() }),
  z.object({ type: z.literal("failed"), requestId: z.string(), message: z.string() }),
]);

export const cancelClaudeRequestSchema = z.object({ requestId: z.string().min(1).max(128) });

export const desktopNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(400),
});

export const CLAUDE_IPC_CHANNELS = {
  checkAvailability: "claude:check-availability",
  generateHomework: "claude:generate-homework",
  summarizeSubmission: "claude:summarize-submission",
  cancelRequest: "claude:cancel-request",
  runtimeEvent: "claude:runtime-event",
} as const;

export const DESKTOP_IPC_CHANNELS = {
  notify: "desktop:notify",
} as const;

export type ClaudeAvailability = z.infer<typeof claudeAvailabilitySchema>;
export type ClaudeGenerationResult = z.infer<typeof claudeGenerationResultSchema>;
export type ClaudeSummaryResult = z.infer<typeof claudeSummaryResultSchema>;
export type ClaudeRuntimeEvent = z.infer<typeof claudeRuntimeEventSchema>;
export type GenerateHomeworkInput = z.infer<typeof generateHomeworkInputSchema>;
export type HomeworkDraft = z.infer<typeof homeworkDraftSchema>;
export type HomeworkQuestion = z.infer<typeof homeworkQuestionSchema>;
export type QuestionContent = z.infer<typeof questionContentSchema>;
export type SummarizeSubmissionInput = z.infer<typeof summarizeSubmissionInputSchema>;
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
export type DesktopNotification = z.infer<typeof desktopNotificationSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;

export interface TeacherDesktopApi {
  readonly platform: string;
  checkClaudeAvailability(): Promise<ClaudeAvailability>;
  generateHomework(input: GenerateHomeworkInput): Promise<ClaudeGenerationResult>;
  summarizeSubmission(input: SummarizeSubmissionInput): Promise<ClaudeSummaryResult>;
  cancelClaudeRequest(requestId: string): Promise<boolean>;
  onClaudeRuntimeEvent(listener: (event: ClaudeRuntimeEvent) => void): () => void;
  /**
   * Shows an OS notification. Resolves false when the notification was skipped,
   * which includes the common case of the window already being focused.
   */
  notify(notification: DesktopNotification): Promise<boolean>;
}
