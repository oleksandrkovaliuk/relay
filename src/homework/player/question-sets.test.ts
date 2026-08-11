import { describe, expect, it } from "vitest";

import { emptyResponse, groupQuestionsIntoSets, isAnswerComplete } from "./answer-types";

describe("groupQuestionsIntoSets", () => {
  it("groups consecutive activities that share a set title", () => {
    const sets = groupQuestionsIntoSets([
      { set: { title: "Which way is the story moving?", task: "Choose one option." } },
      { set: { title: "Which way is the story moving?", task: "Choose one option." } },
      { set: { title: "Type the verb", task: "Use the verb in brackets." } },
    ]);

    expect(sets.map((set) => [set.title, set.questions.length, set.firstStep])).toEqual([
      ["Which way is the story moving?", 2, 1],
      ["Type the verb", 1, 3],
    ]);
  });

  it("starts a new set when a title comes back later in the sheet", () => {
    const sets = groupQuestionsIntoSets([
      { set: { title: "Warm up", task: "" } },
      { set: { title: "Type the verb", task: "" } },
      { set: { title: "Warm up", task: "" } },
    ]);

    expect(sets).toHaveLength(3);
  });

  it("keeps unlabelled activities together as one group", () => {
    expect(groupQuestionsIntoSets([{}, {}, {}])).toHaveLength(1);
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
