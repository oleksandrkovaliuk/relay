import { z } from "zod";

import { homeworkDraftSchema, submissionSummarySchema } from "@/shared/claude";

function toClaudeCompatibleSchema(schema: z.ZodType) {
  const { $schema: _unsupportedMetaschema, ...jsonSchema } = z.toJSONSchema(schema, {
    target: "draft-07",
    io: "output",
  });

  return jsonSchema;
}

export function createHomeworkOutputSchema() {
  return toClaudeCompatibleSchema(homeworkDraftSchema);
}

export function createSummaryOutputSchema() {
  return toClaudeCompatibleSchema(submissionSummarySchema);
}
