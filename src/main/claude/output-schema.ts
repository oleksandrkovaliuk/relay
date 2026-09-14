import { z } from "zod";

import {
  boardAttachmentSchema,
  homeworkDraftSchema,
  homeworkQuestionSchema,
  questionSetSchema,
  referenceRuleSchema,
  questionRewriteOutputSchema,
  submissionSummarySchema,
} from "@/shared/claude";

// Old drafts may predate sections. New generations must supply the teaching
// structure rather than relying on optional fields and prompt instructions.
export const generatedHomeworkSchema = homeworkDraftSchema.extend({
  questions: z.array(homeworkQuestionSchema.safeExtend({ set: questionSetSchema })).min(1).max(130),
  referenceRules: z.array(referenceRuleSchema).min(3).max(5),
});

function toClaudeCompatibleSchema(schema: z.ZodType) {
  const { $schema: _unsupportedMetaschema, ...jsonSchema } = z.toJSONSchema(schema, {
    target: "draft-07",
    io: "output",
  });

  return jsonSchema;
}

export function extractStructuredOutput({
  structuredOutput,
  result,
}: {
  structuredOutput: unknown;
  result: string;
}) {
  if (structuredOutput !== undefined) return structuredOutput;

  const trimmedResult = result.trim();
  if (!trimmedResult) {
    throw new Error("Claude finished without returning a structured result.");
  }

  for (const candidate of jsonCandidates(trimmedResult)) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next shape rather than giving up on the whole reply.
    }
  }
  throw new Error("Claude returned text instead of the requested structured result.");
}

/**
 * The reply in most likely order: the whole thing, then any fenced block, then the
 * outermost braces. Structured output is requested, but a model that adds one
 * sentence of preamble around valid JSON — "Here's the revision:" — used to fail
 * outright, because only a reply that was *entirely* one fenced block was read.
 */
function jsonCandidates(result: string) {
  const candidates = [result];
  for (const fence of result.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    if (fence[1]) candidates.push(fence[1]);
  }
  const firstBrace = result.indexOf("{");
  const lastBrace = result.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(result.slice(firstBrace, lastBrace + 1));
  }
  return candidates;
}

export function createHomeworkOutputSchema() {
  return toClaudeCompatibleSchema(generatedHomeworkSchema);
}

export function createSummaryOutputSchema() {
  return toClaudeCompatibleSchema(submissionSummarySchema);
}

export function createQuestionRewriteOutputSchema() {
  return toClaudeCompatibleSchema(questionRewriteOutputSchema);
}

export function createBoardAttachOutputSchema() {
  return toClaudeCompatibleSchema(boardAttachmentSchema);
}
