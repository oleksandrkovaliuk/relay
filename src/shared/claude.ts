import { z } from "zod";

const nonEmptyString = z.string().min(1);

export const questionContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("multiple_choice"),
    choices: z.array(nonEmptyString).min(2).max(8),
    /** New activities may have more than one correct answer. */
    correctChoices: z.array(z.number().int().min(0)).min(1).max(8).optional(),
    /** Kept while existing assignments still use the original single-answer shape. */
    correctChoice: z.number().int().min(0).optional(),
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
    pairs: z.array(z.object({ left: nonEmptyString, right: nonEmptyString })).min(2).max(14),
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
  /**
   * A short piece of writing with several wrong forms in it, corrected in place.
   * One passage teaches more than the same corrections split into three
   * near-identical one-sentence activities, and it reads as a text rather than
   * as a drill.
   */
  z.object({
    kind: z.literal("proofread"),
    /** The passage, with one `{{1}}`, `{{2}}`, … marker per mistake. */
    text: nonEmptyString.max(2_000),
    errors: z
      .array(
        z.object({
          /** The wrong form as the student sees it, struck through in place. */
          flagged: nonEmptyString.max(120),
          acceptedAnswers: z.array(nonEmptyString).min(1).max(12),
        }),
      )
      .min(2)
      .max(12),
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
  "proofread",
  "short_answer",
  "rewrite",
] as const;

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

/**
 * How many practice items one activity of each type can carry. A worksheet asks
 * for "ten sentences of multiple choice", but ten multiple-choice sentences are
 * ten separate activities while ten cloze gaps are one passage — so a teacher's
 * item count has to be translated into activities per type rather than taken
 * literally everywhere.
 */
export const ACTIVITY_TYPE_ITEM_PLANS: Record<
  ActivityType,
  { itemsPerActivity: number; itemNoun: string }
> = {
  multiple_choice: { itemsPerActivity: 1, itemNoun: "question" },
  fill_blank: { itemsPerActivity: 1, itemNoun: "sentence" },
  matching: { itemsPerActivity: 8, itemNoun: "pair" },
  select_cloze: { itemsPerActivity: 8, itemNoun: "gap" },
  error_fix: { itemsPerActivity: 1, itemNoun: "sentence" },
  proofread: { itemsPerActivity: 6, itemNoun: "mistake" },
  short_answer: { itemsPerActivity: 1, itemNoun: "question" },
  rewrite: { itemsPerActivity: 1, itemNoun: "sentence" },
};

/** What a teacher gets per activity type unless they change it. */
export const DEFAULT_ACTIVITY_ITEM_COUNT = 10;
export const MINIMUM_ACTIVITY_ITEM_COUNT = 3;
export const MAXIMUM_ACTIVITY_ITEM_COUNT = 20;
/**
 * The whole worksheet is written in one structured answer, so its size is bound
 * by what a single response can carry. Past this the run gets slow and starts
 * risking a truncated set, which is worse than a smaller one.
 */
export const MAXIMUM_PLANNED_ITEMS = 70;
/** Roughly how long one practice item takes, used only to show an estimate. */
const MINUTES_PER_ITEM = 0.6;

export const activityPlanEntrySchema = z.object({
  type: activityTypeSchema,
  /** Practice items of this type, not activities: see ACTIVITY_TYPE_ITEM_PLANS. */
  itemCount: z
    .number()
    .int()
    .min(MINIMUM_ACTIVITY_ITEM_COUNT)
    .max(MAXIMUM_ACTIVITY_ITEM_COUNT),
});

/**
 * The teacher now picks the activity types outright, so an empty plan is a brief
 * with nothing in it rather than an invitation for the generator to choose.
 */
export const activityPlanSchema = z
  .array(activityPlanEntrySchema)
  .min(1)
  .max(ACTIVITY_TYPES.length)
  .refine(
    (plan) => new Set(plan.map((entry) => entry.type)).size === plan.length,
    { message: "Each activity type may appear once." },
  )
  .refine(
    (plan) => plan.reduce((total, entry) => total + entry.itemCount, 0) <= MAXIMUM_PLANNED_ITEMS,
    { message: `One homework can hold at most ${MAXIMUM_PLANNED_ITEMS} practice items.` },
  );

export type ActivityPlanEntry = z.infer<typeof activityPlanEntrySchema>;
export type ActivityPlan = z.infer<typeof activityPlanSchema>;

/** One line per requested type: items asked for, and the activities they become. */
export function describeActivityPlan(plan: ActivityPlan) {
  return plan.map((entry) => {
    const { itemsPerActivity, itemNoun } = ACTIVITY_TYPE_ITEM_PLANS[entry.type];
    return {
      ...entry,
      itemsPerActivity,
      itemNoun,
      activityCount: Math.ceil(entry.itemCount / itemsPerActivity),
    };
  });
}

export function countPlannedItems(plan: ActivityPlan) {
  return plan.reduce((total, entry) => total + entry.itemCount, 0);
}

export function countPlannedActivities(plan: ActivityPlan) {
  return describeActivityPlan(plan).reduce((total, entry) => total + entry.activityCount, 0);
}

export function estimatePlanMinutes(plan: ActivityPlan) {
  return Math.max(5, Math.round(countPlannedItems(plan) * MINUTES_PER_ITEM));
}

/** The named set an activity belongs to, e.g. "Set two · Type the verb". */
export const questionSetSchema = z.object({
  title: nonEmptyString.max(160),
  task: nonEmptyString.max(1_000),
});

export const homeworkQuestionSchema = z
  .object({
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
  })
  .superRefine((question, context) => {
    if (question.content.kind !== "multiple_choice") return;
    const correctChoices = question.content.correctChoices ?? [];
    const hasLegacyCorrectChoice = question.content.correctChoice !== undefined;
    if (correctChoices.length === 0 && !hasLegacyCorrectChoice) {
      context.addIssue({
        code: "custom",
        message: "A multiple-choice activity needs at least one correct answer.",
        path: ["content", "correctChoices"],
      });
      return;
    }
    const configuredChoices =
      correctChoices.length > 0 ? correctChoices : [question.content.correctChoice!];
    const choiceCount = question.content.choices.length;
    if (configuredChoices.some((choiceIndex) => choiceIndex >= choiceCount)) {
      context.addIssue({
        code: "custom",
        message: "A correct answer index must reference an available choice.",
        path: ["content", "correctChoices"],
      });
    }
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
  /**
   * A set is now a full worksheet — ten or more items per requested activity
   * type — so the ceiling is what a document can carry, not what a short list
   * looks like.
   */
  questions: z.array(homeworkQuestionSchema).min(1).max(130),
});

/**
 * The models a teacher can pick between. Sonnet is the default because a full
 * set is one large structured answer: Opus spends about three minutes on it,
 * Sonnet a fraction of that, and the difference in the worksheet is small next
 * to the difference in waiting.
 */
export const CLAUDE_MODELS = [
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    description: "The default. Fast enough to wait for, and strong at worksheet writing.",
  },
  {
    id: "claude-opus-5",
    label: "Opus 5",
    description: "Deeper reasoning for tricky briefs. Noticeably slower and dearer.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    description: "Quickest and cheapest. Best for a rough draft you intend to edit.",
  },
] as const;

export const claudeModelSchema = z.enum([
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-haiku-4-5",
]);

export const DEFAULT_CLAUDE_MODEL: ClaudeModel = "claude-sonnet-5";

/**
 * What Relay has learned about this teacher, carried into every request. Each
 * Claude run is a fresh session with no memory of the last one, so continuity is
 * something the app supplies rather than something the model remembers.
 */
export const teachingStyleSchema = z.object({
  /** Their own rules, written once. */
  styleNotes: z.string().max(4_000),
  /** Corrections they have asked for before, newest first. */
  editInstructions: z.array(z.string().max(600)).max(8),
  /** Prompts from sets they published unchanged. */
  keptExamples: z.array(z.string().max(1_200)).max(3),
});

export const generateHomeworkInputSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    studentName: z.string().max(200).optional(),
    studentContext: z.string().max(20_000).optional(),
    recentPerformance: z.string().max(20_000).optional(),
    lessonNotes: z.string().max(100_000),
    /**
     * Set when the teacher asked for the board's newest activity to stand in as
     * the lesson brief. Anything typed in the notes is combined with it.
     */
    miroBoardUrl: z.string().startsWith("https://miro.com/").optional(),
    targetSkills: z.array(nonEmptyString).max(20),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    /** Which widgets to write, and how many items of each. Never inferred. */
    activityPlan: activityPlanSchema,
    /** Omitted falls back to the app default rather than the CLI's. */
    model: claudeModelSchema.optional(),
    teachingStyle: teachingStyleSchema.optional(),
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
  model: claudeModelSchema.optional(),
  teachingStyle: teachingStyleSchema.optional(),
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
  model: claudeModelSchema.optional(),
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
    .max(130),
  model: claudeModelSchema.optional(),
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

/**
 * What the model is asked to return for a rewrite: the question inside a named
 * field, not as the root object. A question has its own `content` field, and
 * asking for one at the root made the model wrap the whole thing in `content`
 * on its first attempt every single time — a rejected tool call and a wasted
 * turn before it corrected itself.
 */
export const questionRewriteOutputSchema = z.object({ question: homeworkQuestionSchema });

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
export type ClaudeModel = z.infer<typeof claudeModelSchema>;
export type TeachingStyle = z.infer<typeof teachingStyleSchema>;
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
