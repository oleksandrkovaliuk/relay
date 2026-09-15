import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import { ClaudeService } from "./claude-service";

it("generates scaffolded adult beginner practice using teacher and learner context", async () => {
  const service = new ClaudeService({ workingDirectory: tmpdir() });
  const availability = await service.checkAvailability();
  expect(availability.isAuthenticated).toBe(true);
  const result = await service.generateHomework({
    requestId: crypto.randomUUID(),
    studentContext: "Adult A1 learner preparing for a train journey. Needs support with polite requests and question order. Can already name common destinations and tickets.",
    recentPerformance: "Recent written work used 'I want ticket' and 'Where the platform is?'",
    lessonNotes: "Ask for train tickets and platform information using Can I have…? and Where is…? Natural adult situations, one decision at a time.",
    difficulty: "beginner",
    targetSkills: ["polite requests", "question order"],
    activityPlan: [{ type: "multiple_choice", itemCount: 3 }, { type: "fill_blank", itemCount: 3 }, { type: "short_answer", itemCount: 3 }],
    teachingStyle: { styleNotes: "Use British English. Include a worked example with different content in each section, then reduce support. No childish contexts or decorative motivational language.", editInstructions: [], keptExamples: [] },
  }, () => undefined);
  const directory = mkdtempSync(join(tmpdir(), "relay-beginner-qa-"));
  writeFileSync(join(directory, "homework.json"), JSON.stringify(result.draft, null, 2));
  console.info(`Beginner quality sample: ${directory}/homework.json`);
  expect(result.draft.questions).toHaveLength(9);
  expect(new Set(result.draft.questions.map((question) => question.type))).toEqual(new Set(["multiple_choice", "fill_blank", "short_answer"]));
  expect(result.draft.questions.every((question) => question.set?.task)).toBe(true);
  expect(result.draft.referenceRules?.length).toBeGreaterThanOrEqual(3);
}, 300_000);
