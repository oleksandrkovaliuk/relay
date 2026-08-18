import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { ConvexHttpClient } from "convex/browser";
import { expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import { ClaudeService } from "./claude-service";

const PIPELINE_TIMEOUT_MILLISECONDS = 300_000;

function readConvexUrl() {
  const environmentFile = readFileSync(".env.local", "utf8");
  const match = environmentFile.match(/^VITE_CONVEX_URL=(.*)$/m);
  const url = match?.[1]?.trim();
  if (!url) throw new Error("VITE_CONVEX_URL is missing from .env.local");
  return url;
}

it(
  "turns student context into a published, playable assignment",
  async () => {
    const convex = new ConvexHttpClient(readConvexUrl());
    const claudeService = new ClaudeService({ workingDirectory: tmpdir() });

    const availability = await claudeService.checkAvailability();
    expect(availability.isAuthenticated).toBe(true);

    const studentId = await convex.mutation(api.students.create, {
      name: "Live Pipeline Student",
      contextNotes:
        "A2 learner. Says 'I have been to the shop yesterday'. Struggles with present perfect vs past simple and forgets third-person -s.",
    });

    const requestId = crypto.randomUUID();
    const aiJobId = await convex.mutation(api.aiJobs.createHomeworkGeneration, {
      requestId,
      title: "Live pipeline homework",
      studentId,
      inputSnapshot: "{}",
    });
    await convex.mutation(api.aiJobs.markRunning, { aiJobId });

    const generated = await claudeService.generateHomework(
      {
        requestId,
        studentName: "Live Pipeline Student",
        studentContext:
          "A2 learner. Says 'I have been to the shop yesterday'. Struggles with present perfect vs past simple and forgets third-person -s.",
        lessonNotes: "We talked about weekend routines and finished holidays.",
        targetSkills: [],
        difficulty: "beginner",
        activityPlan: [
          { type: "multiple_choice", itemCount: 4 },
          { type: "fill_blank", itemCount: 4 },
        ],
      },
      () => undefined,
    );

    const kinds = generated.draft.questions.map((question) => question.content.kind);
    expect(kinds.length).toBeGreaterThanOrEqual(3);

    const homeworkDraftId = await convex.mutation(api.aiJobs.completeHomeworkGeneration, {
      aiJobId,
      draft: generated.draft,
    });
    const published = await convex.mutation(api.assignments.publish, {
      homeworkDraftId,
      shareToken: crypto.randomUUID(),
    });

    const playable = await convex.query(api.assignments.getPublic, {
      shareToken: published.shareToken,
    });
    expect(playable?.questions.length).toBe(generated.draft.questions.length);
    expect(JSON.stringify(playable)).not.toContain("correctChoice");
    expect(JSON.stringify(playable)).not.toContain("acceptedAnswers");

    console.log(`SHARE_TOKEN=${published.shareToken}`);
    console.log(`WIDGET_KINDS=${kinds.join(",")}`);
  },
  PIPELINE_TIMEOUT_MILLISECONDS,
);
