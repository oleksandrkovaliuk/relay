import { describe, expect, it } from "vitest";

import {
  createHomeworkOutputSchema,
  createQuestionRewriteOutputSchema,
  createSummaryOutputSchema,
  extractStructuredOutput,
} from "./output-schema";

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

describe("createQuestionRewriteOutputSchema", () => {
  it("asks for one complete question inside a named field", () => {
    const schema = createQuestionRewriteOutputSchema();

    expect(collectMetaschemaKeys(schema)).toEqual([]);
    /**
     * Named, not the root object. A question carries its own `content`, and a
     * bare question at the root led the model to wrap the whole activity in
     * `content` on its first attempt, wasting a turn on a rejected tool call.
     */
    expect(schema).toMatchObject({ type: "object", required: ["question"] });
    expect(schema).toMatchObject({
      properties: {
        question: {
          type: "object",
          required: [
            "id",
            "type",
            "prompt",
            "instructions",
            "content",
            "skillTags",
            "points",
            "difficulty",
            "explanation",
          ],
        },
      },
    });
  });
});

describe("extractStructuredOutput", () => {
  it("uses the SDK structured output when it is present", () => {
    const structuredOutput = { prompt: "Keep this" };

    expect(extractStructuredOutput({ structuredOutput, result: "ignored" })).toBe(
      structuredOutput,
    );
  });

  it("recovers JSON from the result text when the SDK attachment is missing", () => {
    expect(
      extractStructuredOutput({
        structuredOutput: undefined,
        result: '```json\n{"prompt":"Recovered"}\n```',
      }),
    ).toEqual({ prompt: "Recovered" });
  });

  it("reports a useful error when Claude returns no structured result", () => {
    expect(() =>
      extractStructuredOutput({ structuredOutput: undefined, result: "" }),
    ).toThrow("Claude finished without returning a structured result.");
  });
});
