import { describe, expect, it } from "vitest";

import { buildHomeworkPrompt, buildQuestionRewritePrompt, buildSummaryPrompt } from "./prompt";

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

  it("guarantees the chosen activity types appear without excluding the others", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-5",
      lessonNotes: "Articles practice",
      targetSkills: [],
      durationMinutes: 15,
      difficulty: "beginner",
      activityTypes: ["matching", "fill_blank"],
    });

    expect(prompt).toContain("matching, fill_blank");
    expect(prompt).toContain("Include at least one of each");
    expect(prompt).toContain("keep mixing in other types");
  });

  it("explains the harder formats the generator can reach for", () => {
    const prompt = buildHomeworkPrompt({
      requestId: "request-6",
      lessonNotes: "Present perfect",
      targetSkills: [],
      durationMinutes: 30,
      difficulty: "advanced",
      activityTypes: [],
    });

    expect(prompt).toContain("select_cloze");
    expect(prompt).toContain("dropdown at every gap");
    expect(prompt).toContain("`hint`");
    expect(prompt).toContain("Prefer passage-level work");
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

describe("buildQuestionRewritePrompt", () => {
  it("scopes the teacher's comment to one complete activity", () => {
    const prompt = buildQuestionRewritePrompt({
      requestId: "rewrite-1",
      homeworkTitle: "Travel review",
      homeworkSummary: "Past tense practice",
      teacherInstruction: "Make the distractors more plausible.",
      neighboringPrompts: ["Match the travel words."],
      question: {
        id: "question-1",
        type: "multiple_choice",
        prompt: "Choose the correct sentence.",
        instructions: "Pick one answer.",
        content: {
          kind: "multiple_choice",
          choices: ["I went", "I goed"],
          correctChoice: 0,
        },
        skillTags: ["past-simple"],
        points: 2,
        difficulty: "easy",
        explanation: "Went is irregular.",
      },
    });

    expect(prompt).toContain("Make the distractors more plausible.");
    expect(prompt).toContain("exactly one");
    expect(prompt).toContain("Do not rewrite, add, remove, or reorder");
    expect(prompt).toContain("Keep the current question `id`");
    expect(prompt).toContain("Match the travel words.");
  });
});
