import { describe, expect, it } from "vitest";

import { createHomeworkOutputSchema, createSummaryOutputSchema } from "./output-schema";

function collectMetaschemaKeys(value: unknown, found: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectMetaschemaKeys(item, found);
    return found;
  }
  if (typeof value !== "object" || value === null) return found;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "$schema") found.push(key);
    collectMetaschemaKeys(nested, found);
  }
  return found;
}

describe("createHomeworkOutputSchema", () => {
  it("omits metaschema references Claude Code cannot resolve, at every depth", () => {
    expect(collectMetaschemaKeys(createHomeworkOutputSchema())).toEqual([]);
  });

  it("describes the interactive question widgets", () => {
    const schema = createHomeworkOutputSchema();

    expect(schema).toMatchObject({
      type: "object",
      required: ["title", "summary", "estimatedMinutes", "learningObjectives", "questions"],
    });
    expect(JSON.stringify(schema)).toContain("correctChoice");
    expect(JSON.stringify(schema)).toContain("acceptedAnswers");
    expect(JSON.stringify(schema)).toContain("pairs");
  });
});

describe("createSummaryOutputSchema", () => {
  it("requires teacher-facing summary text", () => {
    expect(collectMetaschemaKeys(createSummaryOutputSchema())).toEqual([]);
    expect(createSummaryOutputSchema()).toMatchObject({
      type: "object",
      required: ["text", "strengths", "focusAreas"],
    });
  });
});
