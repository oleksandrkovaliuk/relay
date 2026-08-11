import { v, type Infer } from "convex/values";

export const questionContentValidator = v.union(
  v.object({
    kind: v.literal("multiple_choice"),
    choices: v.array(v.string()),
    correctChoice: v.number(),
  }),
  v.object({
    kind: v.literal("fill_blank"),
    text: v.string(),
    blanks: v.array(v.object({ acceptedAnswers: v.array(v.string()) })),
  }),
  v.object({
    kind: v.literal("matching"),
    pairs: v.array(v.object({ left: v.string(), right: v.string() })),
  }),
  v.object({
    kind: v.literal("open_response"),
    expectedAnswer: v.optional(v.string()),
  }),
);

export const publicQuestionContentValidator = v.union(
  v.object({ kind: v.literal("multiple_choice"), choices: v.array(v.string()) }),
  v.object({ kind: v.literal("fill_blank"), text: v.string(), blankCount: v.number() }),
  v.object({
    kind: v.literal("matching"),
    lefts: v.array(v.string()),
    rights: v.array(v.string()),
  }),
  v.object({ kind: v.literal("open_response") }),
);

export const answerResponseValidator = v.union(
  v.object({ kind: v.literal("choice"), choiceIndex: v.number() }),
  v.object({ kind: v.literal("blanks"), values: v.array(v.string()) }),
  v.object({ kind: v.literal("matches"), rights: v.array(v.string()) }),
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

export function normalizeText(text: string) {
  return text
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/\s+/g, " ")
    .replaceAll(/[.!?]+$/g, "");
}

export function isAutoGradable(content: QuestionContent) {
  return content.kind !== "open_response";
}

export function toPublicContent(content: QuestionContent): PublicQuestionContent {
  switch (content.kind) {
    case "multiple_choice":
      return { kind: "multiple_choice", choices: content.choices };
    case "fill_blank":
      return { kind: "fill_blank", text: content.text, blankCount: content.blanks.length };
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

function gradedFraction(content: QuestionContent, response: AnswerResponse) {
  if (content.kind === "multiple_choice") {
    const isChosenCorrect =
      response.kind === "choice" && response.choiceIndex === content.correctChoice;
    return isChosenCorrect ? 1 : 0;
  }
  if (content.kind === "fill_blank") {
    const values = response.kind === "blanks" ? response.values : [];
    const matchedBlanks = content.blanks.filter((blank, index) =>
      blank.acceptedAnswers.some(
        (accepted) => normalizeText(accepted) === normalizeText(values[index] ?? ""),
      ),
    );
    return content.blanks.length === 0 ? 0 : matchedBlanks.length / content.blanks.length;
  }
  if (content.kind === "matching") {
    const rights = response.kind === "matches" ? response.rights : [];
    const matchedPairs = content.pairs.filter((pair, index) => pair.right === rights[index]);
    return content.pairs.length === 0 ? 0 : matchedPairs.length / content.pairs.length;
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
  if (response.kind === "choice") {
    if (content.kind !== "multiple_choice") return `Choice ${response.choiceIndex + 1}`;
    return content.choices[response.choiceIndex] ?? `Choice ${response.choiceIndex + 1}`;
  }
  if (response.kind === "blanks") return response.values.join(" · ");
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
      return content.choices[content.correctChoice] ?? null;
    case "fill_blank":
      return content.blanks.map((blank) => blank.acceptedAnswers[0] ?? "").join(" · ");
    case "matching":
      return content.pairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
    case "open_response":
      return content.expectedAnswer ?? null;
  }
}
