import { describe, expect, it } from "vitest";

import {
  emptyResponse,
  groupQuestionsIntoSections,
  isAnswerComplete,
  toWidgetMarking,
} from "./answer-types";

describe("groupQuestionsIntoSections", () => {
  it("puts every activity of one named section on one screen", () => {
    const sections = groupQuestionsIntoSections([
      { type: "multiple_choice", set: { title: "Choose the form", task: "Pick one." } },
      { type: "multiple_choice", set: { title: "Choose the form", task: "Pick one." } },
      { type: "multiple_choice", set: { title: "Choose the form", task: "Pick one." } },
      { type: "short_answer", set: { title: "Say it yourself", task: "Answer in a sentence." } },
    ]);

    expect(
      sections.map((section) => [section.title, section.questions.length, section.firstActivityNumber]),
    ).toEqual([
      ["Choose the form", 3, 1],
      ["Say it yourself", 1, 4],
    ]);
  });

  it("falls back to the activity type for homework written before sections existed", () => {
    const sections = groupQuestionsIntoSections([
      { type: "multiple_choice" },
      { type: "fill_blank" },
      { type: "fill_blank" },
    ]);

    expect(sections.map((section) => [section.title, section.questions.length])).toEqual([
      ["Multiple choice", 1],
      ["Fill blank", 2],
    ]);
  });

  it("gives each section its own key so a repeated title is not merged", () => {
    const sections = groupQuestionsIntoSections([
      { type: "fill_blank", set: { title: "Warm up", task: "" } },
      { type: "matching", set: { title: "Pairs", task: "" } },
      { type: "fill_blank", set: { title: "Warm up", task: "" } },
    ]);

    expect(sections).toHaveLength(3);
    expect(new Set(sections.map((section) => section.key)).size).toBe(3);
  });
});

describe("toWidgetMarking", () => {
  it("names the expected options for multiple choice so a missed answer is not a tick", () => {
    const marking = toWidgetMarking({
      content: { kind: "multiple_choice" },
      correctness: "incorrect",
      correctAnswer: "hadn't locked",
      parts: [
        { isCorrect: false, expected: "Do not select" },
        { isCorrect: false, expected: "Select" },
      ],
    });

    expect(marking.correctChoiceIndices).toEqual([1]);
  });

  it("marks a single typed answer from the activity's own verdict", () => {
    const marking = toWidgetMarking({
      content: { kind: "error_fix" },
      correctness: "correct",
      correctAnswer: "ran",
      parts: [],
    });

    expect(marking.parts).toEqual([{ isCorrect: true, expected: "ran" }]);
  });
});

describe("error_fix answers", () => {
  it("starts empty and completes once the phrase is typed", () => {
    const content = {
      kind: "error_fix" as const,
      before: "Last Tuesday we ",
      flagged: "had ran",
      after: " into our old babysitter.",
    };
    const response = emptyResponse(content);

    expect(response).toEqual({ kind: "text", text: "" });
    expect(isAnswerComplete(response)).toBe(false);
    expect(isAnswerComplete({ kind: "text", text: "ran" })).toBe(true);
  });
});

describe("multiple-choice answers", () => {
  const TWO_ANSWER_QUESTION = {
    kind: "multiple_choice" as const,
    choices: ["Past simple", "Present perfect", "Past perfect"],
    correctChoiceCount: 2,
  };

  it("starts as a multi-select response", () => {
    expect(emptyResponse(TWO_ANSWER_QUESTION)).toEqual({ kind: "choices", choiceIndices: [] });
  });

  /**
   * One pick out of two right answers is a started answer, not a finished one.
   * The progress rail used to call it done and let the student walk past it.
   */
  it("is unfinished until as many options are chosen as the question expects", () => {
    expect(isAnswerComplete({ kind: "choices", choiceIndices: [] }, TWO_ANSWER_QUESTION)).toBe(
      false,
    );
    expect(isAnswerComplete({ kind: "choices", choiceIndices: [0] }, TWO_ANSWER_QUESTION)).toBe(
      false,
    );
    expect(isAnswerComplete({ kind: "choices", choiceIndices: [0, 2] }, TWO_ANSWER_QUESTION)).toBe(
      true,
    );
  });

  it("needs one answer when nothing says otherwise", () => {
    expect(isAnswerComplete({ kind: "choices", choiceIndices: [1] })).toBe(true);
  });
});
