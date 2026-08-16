import { tmpdir } from "node:os";

import { expect, it } from "vitest";

import { ClaudeService } from "./claude-service";

/** The player splits the passage on these; the main process does not import it. */
const GAP_MARKER = /\{\{(\d+)\}\}/g;

const GENERATION_TIMEOUT_MILLISECONDS = 300_000;

/**
 * The proofread widget only works if the generated passage and its list of
 * mistakes line up marker for marker, which no unit test can prove about a
 * model. This asks for one and checks the pieces fit.
 */
it(
  "generates a proofread passage whose markers match its mistakes",
  async () => {
    const service = new ClaudeService({ workingDirectory: tmpdir() });

    const generated = await service.generateHomework(
      {
        requestId: crypto.randomUUID(),
        studentContext:
          "B1 learner. Writes 'I have gone to Lisbon last summer' and forgets past perfect for the earlier event.",
        lessonNotes: "We practised travel stories in the past, and correcting our own writing.",
        targetSkills: ["past perfect", "past simple"],
        durationMinutes: 10,
        difficulty: "intermediate",
        activityTypes: ["proofread"],
      },
      () => undefined,
    );

    const proofread = generated.draft.questions.find(
      (question) => question.content.kind === "proofread",
    );
    if (!proofread || proofread.content.kind !== "proofread") {
      throw new Error("expected a proofread activity in the set");
    }

    const markerCount = [...proofread.content.text.matchAll(GAP_MARKER)].length;
    expect(markerCount).toBe(proofread.content.errors.length);

    // One error_fix at most, and no two activities carrying the same prompt.
    const prompts = generated.draft.questions.map((question) => question.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
    const errorFixCount = generated.draft.questions.filter(
      (question) => question.content.kind === "error_fix",
    ).length;
    expect(errorFixCount).toBeLessThanOrEqual(1);
  },
  GENERATION_TIMEOUT_MILLISECONDS,
);
