import { describe, expect, it } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import type { PlayerQuestion } from "./answer-types";
import {
  parseStoredPlayerProgress,
  PLAYER_STORAGE_VERSION,
  restoreQuestionState,
  type StoredPlayerProgress,
} from "./player-progress";

const SESSION = {
  submissionId: "submission-1" as Id<"submissions">,
  resumeToken: "resume-token",
  studentName: "Mira",
};

const QUESTIONS: PlayerQuestion[] = [
  {
    _id: "choice-question",
    order: 0,
    type: "multiple_choice",
    prompt: "Choose one",
    instructions: "Select the best answer.",
    content: { kind: "multiple_choice", choices: ["One", "Two"], correctChoiceCount: 1 },
    points: 1,
    difficulty: "B1",
  },
  {
    _id: "matching-question",
    order: 1,
    type: "matching",
    prompt: "Match the pairs",
    instructions: "Connect each pair.",
    content: { kind: "matching", lefts: ["A", "B"], rights: ["One", "Two"] },
    points: 2,
    difficulty: "B1",
  },
];

describe("player progress", () => {
  it("restores a completed result and the session needed for feedback", () => {
    const progress: StoredPlayerProgress = {
      version: PLAYER_STORAGE_VERSION,
      session: SESSION,
      index: 1,
      responses: { "choice-question": { kind: "choice", choiceIndex: 0 } },
      result: {
        score: 4,
        maxAutoScore: 5,
        percentage: 80,
        pendingReviewCount: 1,
      },
    };

    expect(parseStoredPlayerProgress(JSON.stringify(progress))).toEqual(progress);
  });

  it("keeps compatible answers and removes stale question data", () => {
    const progress: StoredPlayerProgress = {
      version: PLAYER_STORAGE_VERSION,
      session: SESSION,
      index: 8,
      responses: {
        "choice-question": { kind: "choice", choiceIndex: 1 },
        "matching-question": { kind: "matches", rights: ["Unknown", "Two"] },
        "removed-question": { kind: "text", text: "Old answer" },
      },
    };

    // The step is returned as saved: it counts sections, and only the player
    // knows how many of those the homework has.
    expect(restoreQuestionState(progress, QUESTIONS)).toEqual({
      index: 8,
      responses: { "choice-question": { kind: "choice", choiceIndex: 1 } },
    });
  });

  /**
   * A student halfway through a set when the app updated keeps their typing.
   * Only the position is dropped, because its meaning changed under them.
   */
  it("carries answers over from a snapshot written before sections existed", () => {
    const legacy = {
      version: 1,
      session: SESSION,
      index: 17,
      responses: { "choice-question": { kind: "choice", choiceIndex: 1 } },
    };

    expect(parseStoredPlayerProgress(JSON.stringify(legacy))).toEqual({
      version: PLAYER_STORAGE_VERSION,
      session: SESSION,
      index: 0,
      responses: { "choice-question": { kind: "choice", choiceIndex: 1 } },
    });
  });

  it("rejects malformed snapshots", () => {
    expect(parseStoredPlayerProgress("not-json")).toBeNull();
    expect(
      parseStoredPlayerProgress(
        JSON.stringify({
          version: PLAYER_STORAGE_VERSION,
          session: SESSION,
          index: -1,
          responses: {},
        }),
      ),
    ).toBeNull();
  });
});

describe("restoring a typed correction", () => {
  it("keeps an error_fix answer instead of discarding it", () => {
    const question = {
      _id: "q1",
      order: 0,
      type: "error_fix",
      prompt: "Fix the flagged phrase.",
      instructions: "",
      content: {
        kind: "error_fix" as const,
        before: "Last Tuesday we ",
        flagged: "had ran",
        after: " into our old babysitter.",
      },
      points: 3,
      difficulty: "hard",
    };
    const progress = {
      version: PLAYER_STORAGE_VERSION,
      session: { submissionId: "s1" as never, resumeToken: "r".repeat(20), studentName: "Mira" },
      index: 0,
      responses: { q1: { kind: "text" as const, text: "ran" } },
    };

    expect(restoreQuestionState(progress, [question]).responses.q1).toEqual({
      kind: "text",
      text: "ran",
    });
  });
});
