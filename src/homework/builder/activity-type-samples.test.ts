import { describe, expect, it } from "vitest";

import { emptyResponse, splitBlankText } from "@/homework/player/answer-types";
import { ACTIVITY_TYPES } from "@/shared/claude";

import { ACTIVITY_TYPE_SAMPLES } from "./activity-type-samples";

describe("activity type samples", () => {
  it("has answerable examples for every type the teacher can pin", () => {
    for (const activityType of ACTIVITY_TYPES) {
      const samples = ACTIVITY_TYPE_SAMPLES[activityType];
      expect(samples.length, activityType).toBeGreaterThan(0);
      for (const sample of samples) {
        expect(sample.prompt.length, activityType).toBeGreaterThan(0);
        expect(sample.instructions.length, activityType).toBeGreaterThan(0);
        // The widget renders nothing when the response shape does not match it.
        expect(() => emptyResponse(sample.content), activityType).not.toThrow();
      }
    }
  });

  /**
   * A section preview stacks several of one type, so repeated prompts would draw
   * the same activity three times and teach the teacher nothing about the run.
   */
  it("keeps the examples within one type distinct", () => {
    for (const activityType of ACTIVITY_TYPES) {
      const prompts = ACTIVITY_TYPE_SAMPLES[activityType].map((sample) => sample.prompt);
      expect(new Set(prompts).size, activityType).toBe(prompts.length);
    }
  });

  it("gives every gap in a sample text a matching answer slot", () => {
    for (const activityType of ACTIVITY_TYPES) {
      for (const { content } of ACTIVITY_TYPE_SAMPLES[activityType]) {
        if (content.kind === "fill_blank") {
          const markerCount = splitBlankText(content.text).filter(
            (segment) => segment.blankIndex !== null,
          ).length;
          expect(markerCount).toBe(content.blankCount);
          expect(content.hints).toHaveLength(content.blankCount);
        }
        if (content.kind === "select_cloze") {
          const markerCount = splitBlankText(content.text).filter(
            (segment) => segment.blankIndex !== null,
          ).length;
          expect(markerCount).toBe(content.gaps.length);
        }
        if (content.kind === "proofread") {
          const markerCount = splitBlankText(content.text).filter(
            (segment) => segment.blankIndex !== null,
          ).length;
          expect(markerCount).toBe(content.errors.length);
        }
      }
    }
  });

  it("flags one phrase inside a whole sentence, which is the point of error_fix", () => {
    const content = ACTIVITY_TYPE_SAMPLES.error_fix[0]?.content;
    if (content?.kind !== "error_fix") throw new Error("expected an error_fix sample");

    expect(content.flagged.length).toBeGreaterThan(0);
    expect(`${content.before}${content.flagged}${content.after}`).toBe(
      "When I got to the platform, the train already left, so I waited an hour for the next one.",
    );
  });
});
