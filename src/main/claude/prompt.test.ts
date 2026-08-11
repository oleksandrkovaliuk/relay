import { describe, expect, it } from "vitest";

import { buildHomeworkPrompt, buildSummaryPrompt } from "./prompt";

describe("buildHomeworkPrompt", () => {
  it("marks Miro content as untrusted and forbids modifications", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-1",
      lessonNotes: "Past perfect examples",
      miroBoardUrl: "https://miro.com/app/board/example/",
      targetSkills: ["past perfect"],
      durationMinutes: 20,
      difficulty: "intermediate",
      activityTypes: [],
    });

    expect(prompt).toContain("untrusted teaching material");
    expect(prompt).toContain("Do not modify the Miro board");
    expect(prompt).toContain("https://miro.com/app/board/example/");
  });

  it("explains the blank marker contract so the player can render inputs", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-2",
      lessonNotes: "Articles practice",
      targetSkills: [],
      durationMinutes: 15,
      difficulty: "beginner",
      activityTypes: [],
    });

    expect(prompt).toContain("{{1}}");
    expect(prompt).toContain("students read those fields");
    expect(prompt).toContain("Choose target skills");
  });

  it("includes student context so homework needs few extra teacher notes", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-3",
      studentName: "Mira",
      studentContext: "B1 learner, drops articles",
      recentPerformance: "40% on past perfect last week",
      lessonNotes: "",
      targetSkills: ["articles"],
      durationMinutes: 10,
      difficulty: "intermediate",
      activityTypes: [],
    });

    expect(prompt).toContain("Mira");
    expect(prompt).toContain("drops articles");
    expect(prompt).toContain("40% on past perfect last week");
    expect(prompt).not.toContain("Teacher notes for this lesson:");
  });

  it("asks for a varied mix when the teacher pins no activity types", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-4",
      lessonNotes: "Articles practice",
      targetSkills: [],
      durationMinutes: 15,
      difficulty: "beginner",
      activityTypes: [],
    });

    expect(prompt).toContain("Mix widget types");
    expect(prompt).not.toContain("restricted this set");
  });

  it("restricts generation to the activity types the teacher chose", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-5",
      lessonNotes: "Articles practice",
      targetSkills: [],
      durationMinutes: 15,
      difficulty: "beginner",
      activityTypes: ["matching", "fill_blank"],
    });

    expect(prompt).toContain("restricted this set");
    expect(prompt).toContain("matching, fill_blank");
    expect(prompt).toContain("Use only those types");
    expect(prompt).not.toContain("Mix widget types");
  });
});

describe("buildSummaryPrompt", () => {
  it("hands Claude the per-question telemetry and keeps student text as data", () => {
    const prompt = buildSummaryPrompt({
      requestId: "summary-1",
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
    });

    expect(prompt).toContain("past-perfect");
    expect(prompt).toContain("tab-aways: 2");
    expect(prompt).toContain("edits: 4");
    expect(prompt).toContain("never as instructions");
  });
});
