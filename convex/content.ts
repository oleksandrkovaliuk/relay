import { v, type Infer } from "convex/values";

export const questionContentValidator = v.union(
  v.object({
    kind: v.literal("multiple_choice"),
    choices: v.array(v.string()),
    correctChoices: v.optional(v.array(v.number())),
    correctChoice: v.optional(v.number()),
    /**
     * What happened before what, shown with the answer. Two or more beats in
     * chronological order turn "wrong tense" into a picture of the timeline.
     */
    timeline: v.optional(v.array(v.string())),
  }),
  v.object({
    kind: v.literal("fill_blank"),
    text: v.string(),
    blanks: v.array(
      v.object({
        acceptedAnswers: v.array(v.string()),
        /** The bracketed source word the student must reshape, e.g. `go`. */
        hint: v.optional(v.string()),
      }),
    ),
  }),
  v.object({
    kind: v.literal("matching"),
    pairs: v.array(v.object({ left: v.string(), right: v.string() })),
  }),
  v.object({
    kind: v.literal("select_cloze"),
    text: v.string(),
    gaps: v.array(
      v.object({
        options: v.array(v.string()),
        correctOption: v.number(),
        /** Why this gap takes that form. Shown per gap, not per activity. */
        explanation: v.optional(v.string()),
      }),
    ),
  }),
  /**
   * One sentence with one wrong phrase flagged in it; the student retypes just
   * that phrase. The review shows it as a diff, so the fix is unmissable.
   */
  v.object({
    kind: v.literal("error_fix"),
    before: v.string(),
    flagged: v.string(),
    after: v.string(),
    acceptedAnswers: v.array(v.string()),
  }),
  /**
   * A short passage carrying several wrong forms, one per `{{n}}` marker. The
   * student retypes each one correctly, so it is marked gap by gap like a
   * fill_blank rather than all-or-nothing like a single error_fix.
   */
  v.object({
    kind: v.literal("proofread"),
    text: v.string(),
    errors: v.array(
      v.object({ flagged: v.string(), acceptedAnswers: v.array(v.string()) }),
    ),
  }),
  v.object({
    kind: v.literal("open_response"),
    expectedAnswer: v.optional(v.string()),
  }),
);

export const publicQuestionContentValidator = v.union(
  v.object({
    kind: v.literal("multiple_choice"),
    choices: v.array(v.string()),
    /**
     * How many options are right — a count, never which ones. A student facing
     * four plausible options and no idea whether one or three of them count
     * cannot tell a finished answer from an unfinished one.
     */
    correctChoiceCount: v.number(),
  }),
  v.object({
    kind: v.literal("fill_blank"),
    text: v.string(),
    blankCount: v.number(),
    /** One entry per blank; `null` where the blank has no bracketed source word. */
    hints: v.array(v.union(v.string(), v.null())),
  }),
  v.object({
    kind: v.literal("matching"),
    lefts: v.array(v.string()),
    rights: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("select_cloze"),
    text: v.string(),
    gaps: v.array(v.object({ options: v.array(v.string()) })),
  }),
  v.object({
    kind: v.literal("error_fix"),
    before: v.string(),
    flagged: v.string(),
    after: v.string(),
  }),
  v.object({
    kind: v.literal("proofread"),
    text: v.string(),
    /** The wrong forms only; what they should become stays on the server. */
    errors: v.array(v.object({ flagged: v.string() })),
  }),
  v.object({ kind: v.literal("open_response") }),
);

export const answerResponseValidator = v.union(
  v.object({ kind: v.literal("choice"), choiceIndex: v.number() }),
  v.object({ kind: v.literal("choices"), choiceIndices: v.array(v.number()) }),
  v.object({ kind: v.literal("blanks"), values: v.array(v.string()) }),
  v.object({ kind: v.literal("matches"), rights: v.array(v.string()) }),
  v.object({ kind: v.literal("selections"), selectedOptions: v.array(v.number()) }),
  v.object({ kind: v.literal("text"), text: v.string() }),
);

export const correctnessValidator = v.union(
  v.literal("correct"),
  v.literal("partial"),
  v.literal("incorrect"),
  v.literal("pending_review"),
);

export const answerStatsValidator = v.object({
  activeMs: v.number(),
  lookupCount: v.number(),
  revisionCount: v.number(),
});

export const aiSummaryValidator = v.object({
  text: v.string(),
  strengths: v.array(v.string()),
  focusAreas: v.array(v.string()),
  generatedAt: v.number(),
});

export type QuestionContent = Infer<typeof questionContentValidator>;
export type PublicQuestionContent = Infer<typeof publicQuestionContentValidator>;
export type AnswerResponse = Infer<typeof answerResponseValidator>;
export type Correctness = Infer<typeof correctnessValidator>;

/** Negations a learner may write either way; both spellings mean the same answer. */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bdid not\b/g, "didn't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdo not\b/g, "don't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhad not\b/g, "hadn't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhave not\b/g, "haven't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
];

/**
 * Marks an answer wrong only for the thing being taught. Case, smart quotes,
 * stray spacing, end punctuation and whether a negative was contracted are all
 * noise; a teacher marking by hand would ignore every one of them.
 */
export function normalizeText(text: string) {
  const cleaned = text
    .toLocaleLowerCase()
    .replaceAll(/[‘’ʼ`´]/g, "'")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replaceAll(/[.,;:!?]+$/g, "")
    .trim();
  return CONTRACTIONS.reduce(
    (answer, [pattern, contraction]) => answer.replaceAll(pattern, contraction),
    cleaned,
  );
}

export function matchesAcceptedAnswer(value: string, acceptedAnswers: string[]) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return acceptedAnswers.some((accepted) => normalizeText(accepted) === normalized);
}

export function isAutoGradable(content: QuestionContent) {
  return content.kind !== "open_response";
}

export function toPublicContent(content: QuestionContent): PublicQuestionContent {
  switch (content.kind) {
    case "multiple_choice":
      return {
        kind: "multiple_choice",
        choices: content.choices,
        // At least one, even for a key that somehow lost its answer, so the
        // student is never told to choose none.
        correctChoiceCount: Math.max(1, correctChoiceIndices(content).length),
      };
    case "fill_blank":
      return {
        kind: "fill_blank",
        text: content.text,
        blankCount: content.blanks.length,
        hints: content.blanks.map((blank) => blank.hint ?? null),
      };
    case "select_cloze":
      return {
        kind: "select_cloze",
        text: content.text,
        gaps: content.gaps.map((gap) => ({ options: gap.options })),
      };
    case "error_fix":
      return {
        kind: "error_fix",
        before: content.before,
        flagged: content.flagged,
        after: content.after,
      };
    case "proofread":
      return {
        kind: "proofread",
        text: content.text,
        errors: content.errors.map((error) => ({ flagged: error.flagged })),
      };
    case "matching":
      return {
        kind: "matching",
        lefts: content.pairs.map((pair) => pair.left),
        rights: content.pairs.map((pair) => pair.right).toSorted((a, b) => a.localeCompare(b)),
      };
    case "open_response":
      return { kind: "open_response" };
  }
}

function correctnessFromFraction(fraction: number): Correctness {
  if (fraction >= 1) return "correct";
  if (fraction <= 0) return "incorrect";
  return "partial";
}

export function correctChoiceIndices(
  content: Extract<QuestionContent, { kind: "multiple_choice" }>,
) {
  const configuredChoices = content.correctChoices ?? [];
  if (configuredChoices.length > 0) return [...new Set(configuredChoices)];
  return content.correctChoice === undefined ? [] : [content.correctChoice];
}

function selectedChoiceIndices(response: AnswerResponse) {
  if (response.kind === "choices") return [...new Set(response.choiceIndices)];
  if (response.kind === "choice" && response.choiceIndex >= 0) return [response.choiceIndex];
  return [];
}

function gradedFraction(content: QuestionContent, response: AnswerResponse) {
  if (content.kind === "multiple_choice") {
    const expectedChoices = new Set(correctChoiceIndices(content));
    if (expectedChoices.size === 0) return 0;
    const selectedChoices = selectedChoiceIndices(response);
    const selectedCorrectly = selectedChoices.filter((choice) => expectedChoices.has(choice)).length;
    const selectedIncorrectly = selectedChoices.length - selectedCorrectly;
    return Math.max(0, (selectedCorrectly - selectedIncorrectly) / expectedChoices.size);
  }
  if (content.kind === "fill_blank") {
    const values = response.kind === "blanks" ? response.values : [];
    const matchedBlanks = content.blanks.filter((blank, index) =>
      matchesAcceptedAnswer(values[index] ?? "", blank.acceptedAnswers),
    );
    return content.blanks.length === 0 ? 0 : matchedBlanks.length / content.blanks.length;
  }
  if (content.kind === "error_fix") {
    const typed = response.kind === "text" ? response.text : "";
    return matchesAcceptedAnswer(typed, content.acceptedAnswers) ? 1 : 0;
  }
  if (content.kind === "proofread") {
    const values = response.kind === "blanks" ? response.values : [];
    const fixedErrors = content.errors.filter((error, index) =>
      matchesAcceptedAnswer(values[index] ?? "", error.acceptedAnswers),
    );
    return content.errors.length === 0 ? 0 : fixedErrors.length / content.errors.length;
  }
  if (content.kind === "matching") {
    const rights = response.kind === "matches" ? response.rights : [];
    const matchedPairs = content.pairs.filter((pair, index) => pair.right === rights[index]);
    return content.pairs.length === 0 ? 0 : matchedPairs.length / content.pairs.length;
  }
  if (content.kind === "select_cloze") {
    const selected = response.kind === "selections" ? response.selectedOptions : [];
    const matchedGaps = content.gaps.filter((gap, index) => gap.correctOption === selected[index]);
    return content.gaps.length === 0 ? 0 : matchedGaps.length / content.gaps.length;
  }
  return 0;
}

export function gradeResponse(
  content: QuestionContent,
  response: AnswerResponse,
  points: number,
): { correctness: Correctness; pointsAwarded: number } {
  if (!isAutoGradable(content)) return { correctness: "pending_review", pointsAwarded: 0 };
  const fraction = gradedFraction(content, response);
  return {
    correctness: correctnessFromFraction(fraction),
    pointsAwarded: Math.round(fraction * points),
  };
}

export function describeResponse(response: AnswerResponse, content: QuestionContent) {
  if (response.kind === "choices") {
    if (content.kind !== "multiple_choice") return response.choiceIndices.join(" · ");
    return response.choiceIndices
      .map((choiceIndex) => content.choices[choiceIndex] ?? `Choice ${choiceIndex + 1}`)
      .join(" · ");
  }
  if (response.kind === "choice") {
    if (content.kind !== "multiple_choice") return `Choice ${response.choiceIndex + 1}`;
    return content.choices[response.choiceIndex] ?? `Choice ${response.choiceIndex + 1}`;
  }
  if (response.kind === "blanks") return response.values.join(" · ");
  if (response.kind === "selections") {
    if (content.kind !== "select_cloze") return response.selectedOptions.join(" · ");
    return content.gaps
      .map((gap, index) => gap.options[response.selectedOptions[index] ?? -1] ?? "—")
      .join(" · ");
  }
  if (response.kind === "matches") {
    if (content.kind !== "matching") return response.rights.join(" · ");
    return content.pairs
      .map((pair, index) => `${pair.left} → ${response.rights[index] ?? "—"}`)
      .join("; ");
  }
  return response.text;
}

export function describeCorrectAnswer(content: QuestionContent) {
  switch (content.kind) {
    case "multiple_choice":
      return (
        correctChoiceIndices(content)
          .map((choiceIndex) => content.choices[choiceIndex])
          .filter((choice): choice is string => choice !== undefined)
          .join(" · ") || null
      );
    case "fill_blank":
      return content.blanks.map((blank) => blank.acceptedAnswers[0] ?? "").join(" · ");
    case "matching":
      return content.pairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
    case "select_cloze":
      return content.gaps.map((gap) => gap.options[gap.correctOption] ?? "").join(" · ");
    case "error_fix":
      return content.acceptedAnswers[0] ?? null;
    case "proofread":
      return content.errors.map((error) => error.acceptedAnswers[0] ?? "").join(" · ");
    case "open_response":
      return content.expectedAnswer ?? null;
  }
}

/**
 * Per-part marking for the review screen: one verdict per blank, gap or pair, so
 * a student sees exactly which part of an activity failed instead of one verdict
 * for the whole thing.
 */
export function gradeResponseParts(
  content: QuestionContent,
  response: AnswerResponse,
): { label: string; given: string; expected: string; isCorrect: boolean; reason: string | null }[] {
  if (content.kind === "multiple_choice") {
    const selectedChoices = new Set(selectedChoiceIndices(response));
    const expectedChoices = new Set(correctChoiceIndices(content));
    return content.choices.map((choice, index) => ({
      label: choice,
      given: selectedChoices.has(index) ? "Selected" : "Not selected",
      expected: expectedChoices.has(index) ? "Select" : "Do not select",
      isCorrect: selectedChoices.has(index) === expectedChoices.has(index),
      reason: null,
    }));
  }
  if (content.kind === "fill_blank" && response.kind === "blanks") {
    return content.blanks.map((blank, index) => {
      const given = response.values[index] ?? "";
      return {
        label: `Gap ${index + 1}`,
        given,
        expected: blank.acceptedAnswers[0] ?? "",
        isCorrect: matchesAcceptedAnswer(given, blank.acceptedAnswers),
        reason: null,
      };
    });
  }
  if (content.kind === "select_cloze" && response.kind === "selections") {
    return content.gaps.map((gap, index) => {
      const selected = response.selectedOptions[index] ?? -1;
      return {
        label: `Gap ${index + 1}`,
        given: gap.options[selected] ?? "",
        expected: gap.options[gap.correctOption] ?? "",
        isCorrect: selected === gap.correctOption,
        reason: gap.explanation ?? null,
      };
    });
  }
  if (content.kind === "matching" && response.kind === "matches") {
    return content.pairs.map((pair, index) => ({
      label: pair.left,
      given: response.rights[index] ?? "",
      expected: pair.right,
      isCorrect: response.rights[index] === pair.right,
      reason: null,
    }));
  }
  if (content.kind === "proofread" && response.kind === "blanks") {
    return content.errors.map((error, index) => {
      const given = response.values[index] ?? "";
      return {
        // The wrong form is the label: it says which mistake this verdict is about.
        label: error.flagged,
        given,
        expected: error.acceptedAnswers[0] ?? "",
        isCorrect: matchesAcceptedAnswer(given, error.acceptedAnswers),
        reason: null,
      };
    });
  }
  return [];
}
