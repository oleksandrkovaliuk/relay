import { z } from "zod";

const nonEmptyString = z.string().min(1);

export const questionContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("multiple_choice"),
    choices: z.array(nonEmptyString).min(2).max(8),
    // An index, so an upper bound here only invents a way to fail.
    correctChoice: z.number().int().min(0),
    /**
     * What happened before what, oldest first — "you don't lock the bike" then
     * "you come back and it's gone". Shown with the answer so a tense choice
     * becomes a picture instead of a rule.
     */
    timeline: z.array(nonEmptyString.max(160)).min(1).max(6).optional(),
  }),
  z.object({
    kind: z.literal("fill_blank"),
    text: nonEmptyString,
    blanks: z
      .array(
        z.object({
          acceptedAnswers: z.array(nonEmptyString).min(1).max(12),
          /**
           * The dictionary form the student must reshape, e.g. `go` for `goes`.
           * Shown to the student in brackets next to the gap.
           */
          hint: nonEmptyString.max(40).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    kind: z.literal("matching"),
    pairs: z.array(z.object({ left: nonEmptyString, right: nonEmptyString })).min(2).max(10),
  }),
  z.object({
    kind: z.literal("select_cloze"),
    text: nonEmptyString,
    gaps: z
      .array(
        z.object({
          options: z.array(nonEmptyString).min(2).max(6),
          correctOption: z.number().int().min(0),
          /** One line on why this gap takes that form, shown per gap. */
          explanation: nonEmptyString.max(1_000).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    kind: z.literal("error_fix"),
    /** The sentence, split around the one phrase that is wrong. */
    before: z.string().max(1_000),
    flagged: nonEmptyString.max(300),
    after: z.string().max(1_000),
    acceptedAnswers: z.array(nonEmptyString).min(1).max(12),
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
  "select_cloze",
  "error_fix",
  "short_answer",
  "rewrite",
] as const;

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

/** The named set an activity belongs to, e.g. "Set two · Type the verb". */
export const questionSetSchema = z.object({
  title: nonEmptyString.max(160),
  task: nonEmptyString.max(1_000),
});

export const homeworkQuestionSchema = z.object({
  id: nonEmptyString,
  type: activityTypeSchema,
  prompt: nonEmptyString,
  instructions: nonEmptyString,
  content: questionContentSchema,
  skillTags: z.array(nonEmptyString).min(1).max(8),
  points: z.number().int().min(1).max(50),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /**
   * Why the right answer is right and, where it helps, why the tempting wrong
   * one is wrong. Shown to the student after they submit.
   */
  explanation: nonEmptyString,
  /** Activities sharing a title form one set, in order. */
  set: questionSetSchema.optional(),
});

/** One line of the cheat sheet: a form and what it does. */
export const referenceRuleSchema = z.object({
  term: nonEmptyString.max(120),
  explanation: nonEmptyString.max(1_200),
});

export const homeworkDraftSchema = z.object({
  /**
   * Topic and focus only: a set may be reassigned, so it carries no name. These
   * bounds are a safety net, not the style guide — brevity is asked for in the
   * prompt, because a title three words too long must never throw away an
   * otherwise good homework set.
   */
  title: nonEmptyString.max(300),
  summary: nonEmptyString.max(4_000),
  estimatedMinutes: z.number().int().min(5).max(180),
  learningObjectives: z.array(nonEmptyString).min(1).max(12),
  /** The collapsible cheat sheet the student can open while working. */
  referenceRules: z.array(referenceRuleSchema).max(12).optional(),
  questions: z.array(homeworkQuestionSchema).min(1).max(30),
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

export const rewriteHomeworkQuestionInputSchema = z.object({
  requestId: z.string().min(1).max(128),
  homeworkTitle: z.string().min(1).max(300),
  homeworkSummary: z.string().min(1).max(20_000),
  teacherInstruction: z.string().min(1).max(10_000),
  question: homeworkQuestionSchema,
  neighboringPrompts: z.array(z.string().min(1).max(20_000)).max(4),
});

/**
 * Attaching homework to a board is done by Claude through the teacher's own Miro
 * MCP server — the same connection homework generation already reads boards with.
 * Relay never holds a Miro credential of its own.
 */
export const attachHomeworkToBoardInputSchema = z.object({
  requestId: z.string().min(1).max(128),
  miroBoardUrl: z.string().startsWith("https://miro.com/"),
  title: nonEmptyString.max(300),
  summary: z.string().max(2_000),
  shareUrl: z.string().url(),
});

export const boardAttachmentSchema = z.object({
  /** The frame the homework landed in — the unit the student studied last. */
  unitTitle: z.string().nullable(),
  /** One line for the teacher on what was added and where. */
  note: nonEmptyString.max(400),
});

export const claudeBoardAttachmentResultSchema = z.object({
  requestId: z.string(),
  attachment: boardAttachmentSchema,
});

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

export const claudeQuestionRewriteResultSchema = z.object({
  requestId: z.string(),
  question: homeworkQuestionSchema,
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

/** Shape of `claude auth status --json` for one config directory. */
export const claudeAccountSchema = z.object({
  loggedIn: z.boolean(),
  email: z.string().optional(),
  authMethod: z.string().optional(),
  orgName: z.string().optional(),
  subscriptionType: z.string().optional(),
});

/**
 * One Claude Code login as persisted on disk. The CLI keeps a single account per
 * config directory, so a teacher with two accounts has two connections pointing
 * at two directories. All connections write into the same workspace, so homework
 * and students are shared regardless of which account generated them.
 */
export const storedClaudeConnectionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  /** `null` means the CLI's own default location, i.e. the existing login. */
  configDir: z.string().min(1).nullable(),
  isActive: z.boolean(),
});

export const storedClaudeConnectionStateSchema = z.object({
  connections: z.array(storedClaudeConnectionSchema).min(1),
});

/** What the renderer receives: the stored connection plus who is signed in. */
export const claudeConnectionSchema = storedClaudeConnectionSchema.extend({
  account: claudeAccountSchema.nullable(),
});

export const claudeLoginEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({ type: z.literal("browser_opened"), url: z.string() }),
  z.object({ type: z.literal("code_requested") }),
  z.object({ type: z.literal("completed") }),
  z.object({ type: z.literal("failed"), message: z.string() }),
]);

export const startClaudeLoginSchema = z.object({
  id: z.string().min(1).max(64),
  email: z.string().max(200).optional(),
});

export const submitClaudeLoginCodeSchema = z.object({ code: z.string().min(1).max(4096) });

export const claudeConnectionStateSchema = z.object({
  connections: z.array(claudeConnectionSchema).min(1),
});

export const addClaudeConnectionSchema = z.object({ label: z.string().min(1).max(60) });
export const claudeConnectionRefSchema = z.object({ id: z.string().min(1).max(64) });

export const CLAUDE_IPC_CHANNELS = {
  checkAvailability: "claude:check-availability",
  generateHomework: "claude:generate-homework",
  rewriteHomeworkQuestion: "claude:rewrite-homework-question",
  attachHomeworkToBoard: "claude:attach-homework-to-board",
  summarizeSubmission: "claude:summarize-submission",
  cancelRequest: "claude:cancel-request",
  runtimeEvent: "claude:runtime-event",
} as const;

export const DESKTOP_IPC_CHANNELS = {
  notify: "desktop:notify",
} as const;

export const CLAUDE_CONNECTION_IPC_CHANNELS = {
  list: "claude:connections:list",
  add: "claude:connections:add",
  activate: "claude:connections:activate",
  remove: "claude:connections:remove",
  loginCommand: "claude:connections:login-command",
  startLogin: "claude:connections:start-login",
  submitLoginCode: "claude:connections:submit-login-code",
  cancelLogin: "claude:connections:cancel-login",
  loginEvent: "claude:connections:login-event",
} as const;

export type ClaudeAvailability = z.infer<typeof claudeAvailabilitySchema>;
export type ClaudeGenerationResult = z.infer<typeof claudeGenerationResultSchema>;
export type ClaudeSummaryResult = z.infer<typeof claudeSummaryResultSchema>;
export type ClaudeQuestionRewriteResult = z.infer<typeof claudeQuestionRewriteResultSchema>;
export type ClaudeRuntimeEvent = z.infer<typeof claudeRuntimeEventSchema>;
export type GenerateHomeworkInput = z.infer<typeof generateHomeworkInputSchema>;
export type AttachHomeworkToBoardInput = z.infer<typeof attachHomeworkToBoardInputSchema>;
export type ClaudeBoardAttachmentResult = z.infer<typeof claudeBoardAttachmentResultSchema>;
export type BoardAttachment = z.infer<typeof boardAttachmentSchema>;

export type RewriteHomeworkQuestionInput = z.infer<
  typeof rewriteHomeworkQuestionInputSchema
>;
export type HomeworkDraft = z.infer<typeof homeworkDraftSchema>;
export type HomeworkQuestion = z.infer<typeof homeworkQuestionSchema>;
export type QuestionContent = z.infer<typeof questionContentSchema>;
export type SummarizeSubmissionInput = z.infer<typeof summarizeSubmissionInputSchema>;
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
export type DesktopNotification = z.infer<typeof desktopNotificationSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type StoredClaudeConnection = z.infer<typeof storedClaudeConnectionSchema>;
export type StoredClaudeConnectionState = z.infer<typeof storedClaudeConnectionStateSchema>;
export type ClaudeConnection = z.infer<typeof claudeConnectionSchema>;
export type ClaudeConnectionState = z.infer<typeof claudeConnectionStateSchema>;
export type ClaudeAccount = z.infer<typeof claudeAccountSchema>;
export type ClaudeLoginEvent = z.infer<typeof claudeLoginEventSchema>;

export interface TeacherDesktopApi {
  readonly platform: string;
  checkClaudeAvailability(): Promise<ClaudeAvailability>;
  generateHomework(input: GenerateHomeworkInput): Promise<ClaudeGenerationResult>;
  rewriteHomeworkQuestion(
    input: RewriteHomeworkQuestionInput,
  ): Promise<ClaudeQuestionRewriteResult>;
  summarizeSubmission(input: SummarizeSubmissionInput): Promise<ClaudeSummaryResult>;
  attachHomeworkToBoard(
    input: AttachHomeworkToBoardInput,
  ): Promise<ClaudeBoardAttachmentResult>;
  cancelClaudeRequest(requestId: string): Promise<boolean>;
  onClaudeRuntimeEvent(listener: (event: ClaudeRuntimeEvent) => void): () => void;
  /**
   * Shows an OS notification. Resolves false when the notification was skipped,
   * which includes the common case of the window already being focused.
   */
  notify(notification: DesktopNotification): Promise<boolean>;
  listClaudeConnections(): Promise<ClaudeConnectionState>;
  addClaudeConnection(label: string): Promise<ClaudeConnectionState>;
  activateClaudeConnection(id: string): Promise<ClaudeConnectionState>;
  removeClaudeConnection(id: string): Promise<ClaudeConnectionState>;
  /** Fallback for when the in-app sign-in cannot run: the equivalent command. */
  claudeLoginCommand(id: string): Promise<string>;
  /** Starts `claude auth login` for one connection and streams its progress. */
  startClaudeLogin(input: { id: string; email?: string }): Promise<void>;
  submitClaudeLoginCode(code: string): Promise<void>;
  cancelClaudeLogin(): Promise<void>;
  onClaudeLoginEvent(listener: (event: ClaudeLoginEvent) => void): () => void;
}
