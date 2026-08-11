import { writeFileSync } from "node:fs";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { expect, it } from "vitest";

import { homeworkDraftSchema, submissionSummarySchema } from "@/shared/claude";
import { createHomeworkOutputSchema, createSummaryOutputSchema } from "./output-schema";
import { buildHomeworkPrompt, buildSummaryPrompt } from "./prompt";

const PROBE_TIMEOUT_MILLISECONDS = 300_000;
const PROBE_OUTPUT_DIRECTORY =
  "/private/tmp/claude-501/-Users-sasakovaluk-projects-erm/8bf13895-a635-4ef1-8d4c-62cf6915d338/scratchpad";

async function runStructured(prompt: string, schema: Record<string, unknown>) {
  const runtime = query({
    prompt,
    options: {
      maxTurns: 2,
      outputFormat: { type: "json_schema", schema },
      permissionMode: "default",
      persistSession: false,
      settingSources: ["user"],
      tools: [],
    },
  });
  for await (const message of runtime) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success") throw new Error(`Claude failed: ${message.subtype}`);
    return message.structured_output;
  }
  throw new Error("no result");
}

it(
  "produces a homework draft matching the interactive widget schema",
  async () => {
    const output = await runStructured(
      buildHomeworkPrompt({
        requestId: "probe",
        studentName: "Mira",
        studentContext: "B1 learner. Drops articles and confuses past simple with past perfect.",
        lessonNotes: "Practiced travel stories. New words: platform, delayed, luggage.",
        targetSkills: ["past perfect", "travel vocabulary"],
        durationMinutes: 10,
        difficulty: "intermediate",
        activityTypes: [],
      }),
      createHomeworkOutputSchema(),
    );
    const parsed = homeworkDraftSchema.safeParse(output);
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2));
      console.error(JSON.stringify(output, null, 2).slice(0, 6000));
    }
    expect(parsed.success).toBe(true);
    writeFileSync(`${PROBE_OUTPUT_DIRECTORY}/${expect.getState().currentTestName}.json`, JSON.stringify(parsed.data, null, 2));
  },
  PROBE_TIMEOUT_MILLISECONDS,
);

it(
  "produces a teacher-facing submission summary",
  async () => {
    const output = await runStructured(
      buildSummaryPrompt({
        requestId: "probe-summary",
        studentName: "Mira",
        assignmentTitle: "Past perfect travel review",
        scorePercentage: 60,
        activeMinutes: 12,
        lookupCount: 3,
        questions: [
          {
            prompt: "By the time we arrived, the train ___.",
            skillTags: ["past-perfect"],
            correctness: "incorrect",
            studentAnswer: "left",
            correctAnswer: "had left",
            activeSeconds: 95,
            lookupCount: 2,
            revisionCount: 4,
          },
        ],
      }),
      createSummaryOutputSchema(),
    );
    const parsed = submissionSummarySchema.safeParse(output);
    if (!parsed.success) console.error(JSON.stringify(parsed.error.issues, null, 2));
    expect(parsed.success).toBe(true);
    writeFileSync(`${PROBE_OUTPUT_DIRECTORY}/${expect.getState().currentTestName}.json`, JSON.stringify(parsed.data, null, 2));
  },
  PROBE_TIMEOUT_MILLISECONDS,
);
