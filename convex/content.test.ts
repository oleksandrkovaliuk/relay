import { describe, expect, test } from "vitest";

import {
  describeCorrectAnswer,
  gradeResponse,
  gradeResponseParts,
  toPublicContent,
  type QuestionContent,
} from "./content";

const proofreadContent: QuestionContent = {
  kind: "proofread",
  text: "Last summer I {{1}} to Lisbon. By then my friend {{2}} the city for three days.",
  errors: [
    { flagged: "have gone", acceptedAnswers: ["went"] },
    { flagged: "explores", acceptedAnswers: ["had explored", "'d explored"] },
  ],
};

describe("proofread content", () => {
  test("never sends the corrections to the student", () => {
    const published = toPublicContent(proofreadContent);
    if (published.kind !== "proofread") throw new Error("expected a proofread activity");

    expect(published.text).toBe(proofreadContent.text);
    expect(published.errors).toEqual([{ flagged: "have gone" }, { flagged: "explores" }]);
    expect(JSON.stringify(published)).not.toContain("went");
  });

  test("marks each correction on its own, like the gaps it looks like", () => {
    const halfRight = gradeResponse(
      proofreadContent,
      { kind: "blanks", values: ["went", "explored"] },
      8,
    );

    expect(halfRight).toEqual({ correctness: "partial", pointsAwarded: 4 });
    expect(
      gradeResponse(proofreadContent, { kind: "blanks", values: ["Went.", "had explored"] }, 8),
    ).toEqual({ correctness: "correct", pointsAwarded: 8 });
    expect(gradeResponse(proofreadContent, { kind: "blanks", values: ["", ""] }, 8)).toEqual({
      correctness: "incorrect",
      pointsAwarded: 0,
    });
  });

  test("labels each verdict with the wrong form it belongs to", () => {
    const parts = gradeResponseParts(proofreadContent, {
      kind: "blanks",
      values: ["went", "explored"],
    });

    expect(parts).toEqual([
      { label: "have gone", given: "went", expected: "went", isCorrect: true, reason: null },
      {
        label: "explores",
        given: "explored",
        expected: "had explored",
        isCorrect: false,
        reason: null,
      },
    ]);
  });

  test("summarises the answer key for the teacher", () => {
    expect(describeCorrectAnswer(proofreadContent)).toBe("went · had explored");
  });
});
