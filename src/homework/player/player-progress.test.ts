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
    content: { kind: "multiple_choice", choices: ["One", "Two"] },
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

    expect(restoreQuestionState(progress, QUESTIONS)).toEqual({
      index: 1,
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
