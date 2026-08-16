import { tmpdir } from "node:os";

import { expect, it } from "vitest";

import { homeworkQuestionSchema } from "@/shared/claude";
import { ClaudeService } from "./claude-service";

const REWRITE_TIMEOUT_MILLISECONDS = 300_000;

/**
 * The teacher's "Ask Claude" edit, end to end. It is here because the failure it
 * guards against was invisible to unit tests: the model answered with a valid
 * question in the wrong wrapper, the tool call was rejected, and the retries ate
 * the turn budget until the run ended with nothing.
 */
it(
  "rewrites one activity in a single structured answer",
  async () => {
    const service = new ClaudeService({ workingDirectory: tmpdir() });
    const toolCalls: string[] = [];

    const result = await service.rewriteHomeworkQuestion(
      {
        requestId: crypto.randomUUID(),
        homeworkTitle: "Past simple, continuous and perfect in narrative",
        homeworkSummary: "Contrasting past forms inside one connected story.",
        teacherInstruction: "Make the pairs shorter and easier to scan.",
        neighboringPrompts: ["Correct the highlighted phrase."],
        question: {
          id: "question-matching",
          type: "matching",
          prompt: "Match each sentence with the meaning its verb form expresses.",
          instructions: "Read all six sentences before you start.",
          content: {
            kind: "matching",
            pairs: [
              {
                left: "When the guests arrived, Marta cooked dinner.",
                right: "She started cooking after they got there.",
              },
              {
                left: "When the guests arrived, Marta had cooked dinner.",
                right: "The dinner was already finished when they got there.",
              },
              {
                left: "When the guests arrived, Marta was cooking dinner.",
                right: "She was in the middle of cooking as they got there.",
              },
              {
                left: "Marta used to cook dinner every Sunday.",
                right: "A repeated past habit that has since stopped.",
              },
            ],
          },
          skillTags: ["past perfect", "past continuous"],
          points: 6,
          difficulty: "hard",
          explanation: "Each form fixes a different point in time relative to the arrival.",
        },
      },
      (event) => {
        if (event.type === "tool_started") toolCalls.push(event.toolName);
      },
    );

    expect(homeworkQuestionSchema.safeParse(result.question).success).toBe(true);
    expect(result.question.id).toBe("question-matching");
    // One accepted answer. A second call means the first was rejected again.
    expect(toolCalls.filter((name) => name === "StructuredOutput")).toHaveLength(1);
  },
  REWRITE_TIMEOUT_MILLISECONDS,
);
