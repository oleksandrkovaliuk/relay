import { describe, expect, it } from "vitest";

import { homeworkDraftSchema, homeworkQuestionSchema } from "./claude";

/**
 * These bounds decide whether a generation survives. Claude is asked in the
 * prompt for a short title and a two-sentence summary, but a set that overshoots
 * by a few words must still reach the teacher — rejecting it loses the entire
 * homework, which is far worse than a long heading.
 */
const QUESTION = {
  id: "q1",
  type: "multiple_choice" as const,
  prompt: "When I came back an hour later, my bike was gone. I ______ it.",
  instructions: "Choose one option.",
  content: {
    kind: "multiple_choice" as const,
    choices: ["didn't lock", "hadn't locked"],
    correctChoice: 1,
  },
  skillTags: ["past-perfect"],
  points: 2,
  difficulty: "medium" as const,
  explanation: "The not-locking is older than the moment you came back.",
};

function draftWith(overrides: Record<string, unknown>) {
  return homeworkDraftSchema.safeParse({
    title: "Past simple vs past perfect",
    summary: "A short set on the order of past events.",
    estimatedMinutes: 30,
    learningObjectives: ["Choose the right past form"],
    questions: [QUESTION],
    ...overrides,
  });
}

describe("generated homework is accepted even when it overshoots the brief", () => {
  it("keeps a title that ignored the length request", () => {
    const title =
      "Mira — Work Trip English: Past Simple, Present Simple & Articles (Advanced Review)";
    expect(draftWith({ title }).success).toBe(true);
  });

  it("keeps a summary that ran long", () => {
    expect(draftWith({ summary: "word ".repeat(160) }).success).toBe(true);
  });

  it("keeps more learning objectives than asked for", () => {
    const learningObjectives = Array.from({ length: 10 }, (_, index) => `Objective ${index}`);
    expect(draftWith({ learningObjectives }).success).toBe(true);
  });

  it("keeps a one-beat timeline rather than dropping the question", () => {
    const result = homeworkQuestionSchema.safeParse({
      ...QUESTION,
      content: { ...QUESTION.content, timeline: ["you come back and it's gone"] },
    });
    expect(result.success).toBe(true);
  });

  it("keeps a five-option question", () => {
    const result = homeworkQuestionSchema.safeParse({
      ...QUESTION,
      content: {
        kind: "multiple_choice",
        choices: ["a", "b", "c", "d", "e"],
        correctChoice: 4,
      },
    });
    expect(result.success).toBe(true);
  });

  it("keeps a two-gap passage", () => {
    const result = homeworkQuestionSchema.safeParse({
      ...QUESTION,
      type: "select_cloze",
      content: {
        kind: "select_cloze",
        text: "I {{1}} home when it {{2}} raining.",
        gaps: [
          { options: ["walked", "was walking"], correctOption: 1 },
          { options: ["started", "had started"], correctOption: 0 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("still rejects output that is genuinely unusable", () => {
    expect(draftWith({ title: "" }).success).toBe(false);
    expect(draftWith({ questions: [] }).success).toBe(false);
  });
});
