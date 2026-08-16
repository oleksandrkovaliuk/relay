import { describe, expect, it } from "vitest";

import { emptyResponse, splitBlankText } from "@/homework/player/answer-types";
import { ACTIVITY_TYPES } from "@/shared/claude";

import { ACTIVITY_TYPE_SAMPLES } from "./activity-type-samples";

describe("activity type samples", () => {
  it("has an answerable example for every type the teacher can pin", () => {
    for (const activityType of ACTIVITY_TYPES) {
      const sample = ACTIVITY_TYPE_SAMPLES[activityType];
      expect(sample, activityType).toBeDefined();
      expect(sample.prompt.length, activityType).toBeGreaterThan(0);
      expect(sample.instructions.length, activityType).toBeGreaterThan(0);
      // The widget renders nothing when the response shape does not match it.
      expect(() => emptyResponse(sample.content), activityType).not.toThrow();
    }
  });

  it("gives every gap in a sample text a matching answer slot", () => {
    for (const activityType of ACTIVITY_TYPES) {
      const { content } = ACTIVITY_TYPE_SAMPLES[activityType];
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
    }
  });

  it("flags one phrase inside a whole sentence, which is the point of error_fix", () => {
    const { content } = ACTIVITY_TYPE_SAMPLES.error_fix;
    if (content.kind !== "error_fix") throw new Error("expected an error_fix sample");

    expect(content.flagged.length).toBeGreaterThan(0);
    expect(`${content.before}${content.flagged}${content.after}`).toBe(
      "When I got to the platform, the train already left, so I waited an hour for the next one.",
    );
  });
});
