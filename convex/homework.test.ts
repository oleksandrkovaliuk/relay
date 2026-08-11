/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const NEUTRAL_STATS = { activeMs: 1000, lookupCount: 0, revisionCount: 1 };

function createBackend() {
  return convexTest(schema, modules);
}

async function seedPublished(backend: ReturnType<typeof createBackend>, shareToken: string) {
  return backend.mutation(internal.seed.demoHomework, { shareToken });
}

async function loadQuestions(
  backend: ReturnType<typeof createBackend>,
  shareToken: string,
) {
  const assignment = await backend.query(api.assignments.getPublic, { shareToken });
  if (!assignment) throw new Error("expected a published assignment");
  return assignment.questions;
}

describe("students", () => {
  test("stores context and rejects a non-Miro board URL", async () => {
    const backend = createBackend();
    const studentId = await backend.mutation(api.students.create, {
      name: "Mira",
      miroBoardUrl: "https://miro.com/app/board/abc/",
      contextNotes: "B1, drops articles",
    });

    const students = await backend.query(api.students.list);
    expect(students).toMatchObject([
      { _id: studentId, name: "Mira", contextNotes: "B1, drops articles" },
    ]);

    await expect(
      backend.mutation(api.students.create, {
        name: "Impostor",
        miroBoardUrl: "https://evil.example.com/board",
        contextNotes: "",
      }),
    ).rejects.toThrow(/miro\.com/i);
  });
});

describe("assignments", () => {
  test("hides answer keys from the public query", async () => {
    const backend = createBackend();
    await seedPublished(backend, "public-token-000000000000");
    const assignment = await backend.query(api.assignments.getPublic, {
      shareToken: "public-token-000000000000",
    });

    const serialized = JSON.stringify(assignment);
    expect(serialized).not.toContain("correctChoice");
    expect(serialized).not.toContain("acceptedAnswers");
    expect(serialized).not.toContain("expectedAnswer");
    expect(serialized).not.toContain("explanation");
  });

  test("shuffles matching answers away from their prompt order", async () => {
    const backend = createBackend();
    await seedPublished(backend, "matching-token-00000000000");
    const questions = await loadQuestions(backend, "matching-token-00000000000");
    const matching = questions.find((question) => question.content.kind === "matching");
    if (matching?.content.kind !== "matching") throw new Error("expected a matching question");

    expect(matching.content.lefts).toEqual(["platform", "delayed", "luggage"]);
    expect(matching.content.rights).not.toEqual([
      "the raised area beside the track",
      "later than the planned time",
      "the bags you carry when you travel",
    ]);
    expect(matching.content.rights.toSorted()).toEqual(
      [
        "the raised area beside the track",
        "later than the planned time",
        "the bags you carry when you travel",
      ].toSorted(),
    );
  });

  test("refuses to publish the same draft twice", async () => {
    const backend = createBackend();
    await seedPublished(backend, "duplicate-token-0000000000");
    const drafts = await backend.run(async (ctx) => ctx.db.query("homeworkDrafts").collect());
    const homeworkDraftId = drafts[0]?._id;
    if (!homeworkDraftId) throw new Error("expected a draft");

    await expect(
      backend.mutation(api.assignments.publish, {
        homeworkDraftId,
        shareToken: "another-token-00000000000",
      }),
    ).rejects.toThrow(/already published/i);
  });

  test("discards an unpublished draft and preserves its AI job audit record", async () => {
    const backend = createBackend();
    const { aiJobId, homeworkDraftId } = await createUnpublishedDraft(backend);

    const result = await backend.mutation(api.assignments.discardDraft, {
      homeworkDraftId,
    });

    expect(result).toEqual({ homeworkDraftId, deletedQuestionCount: 2 });
    const persisted = await backend.run(async (ctx) => ({
      aiJob: await ctx.db.get("aiJobs", aiJobId),
      draft: await ctx.db.get("homeworkDrafts", homeworkDraftId),
      questions: await ctx.db
        .query("homeworkQuestions")
        .withIndex("by_homeworkDraftId_and_order", (q) =>
          q.eq("homeworkDraftId", homeworkDraftId),
        )
        .take(3),
    }));
    expect(persisted.aiJob?.status).toBe("completed");
    expect(persisted.draft).toBeNull();
    expect(persisted.questions).toEqual([]);
  });

  test("refuses to discard a draft after it has been published", async () => {
    const backend = createBackend();
    const shareToken = "discard-published-000000000";
    await seedPublished(backend, shareToken);
    const assignment = await backend.run(async (ctx) =>
      ctx.db
        .query("assignments")
        .withIndex("by_shareToken", (q) => q.eq("shareToken", shareToken))
        .unique(),
    );
    if (!assignment) throw new Error("expected a published assignment");

    await expect(
      backend.mutation(api.assignments.discardDraft, {
        homeworkDraftId: assignment.homeworkDraftId,
      }),
    ).rejects.toThrow(/published homework drafts cannot be discarded/i);

    const draft = await backend.run(async (ctx) =>
      ctx.db.get("homeworkDrafts", assignment.homeworkDraftId),
    );
    expect(draft).not.toBeNull();
  });
});

describe("grading", () => {
  test("awards full credit for correct structured answers", async () => {
    const backend = createBackend();
    await seedPublished(backend, "grade-token-0000000000000");
    const questions = await loadQuestions(backend, "grade-token-0000000000000");
    const resumeToken = "resume-token-000000000000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken: "grade-token-0000000000000",
      resumeToken,
    });

    for (const question of questions) {
      const response = correctResponseFor(question);
      await backend.mutation(api.submissions.saveAnswer, {
        submissionId: started.submissionId,
        resumeToken,
        questionId: question._id,
        response,
        stats: NEUTRAL_STATS,
      });
    }

    const result = await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });
    expect(result).toMatchObject({ score: 9, maxAutoScore: 9, percentage: 100 });
    expect(result.pendingReviewCount).toBe(1);
  });

  test("gives partial credit per blank and marks a wrong choice incorrect", async () => {
    const backend = createBackend();
    await seedPublished(backend, "partial-token-00000000000");
    const questions = await loadQuestions(backend, "partial-token-00000000000");
    const resumeToken = "resume-partial-0000000000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken: "partial-token-00000000000",
      resumeToken,
    });

    const multipleChoice = questions.find((q) => q.content.kind === "multiple_choice");
    const fillBlank = questions.find((q) => q.content.kind === "fill_blank");
    if (!multipleChoice || !fillBlank) throw new Error("expected both question kinds");

    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: multipleChoice._id,
      response: { kind: "choice", choiceIndex: 1 },
      stats: NEUTRAL_STATS,
    });
    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: fillBlank._id,
      response: { kind: "blanks", values: ["the", "a", "the"] },
      stats: NEUTRAL_STATS,
    });
    await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });

    const detail = await backend.query(api.submissions.detail, {
      submissionId: started.submissionId,
    });
    const choiceAnswer = detail?.answers.find((a) => a.questionId === multipleChoice._id);
    const blankAnswer = detail?.answers.find((a) => a.questionId === fillBlank._id);
    expect(choiceAnswer).toMatchObject({ correctness: "incorrect", pointsAwarded: 0 });
    expect(blankAnswer).toMatchObject({ correctness: "partial", pointsAwarded: 2 });
  });

  test("returns every assignment question in order including unanswered steps", async () => {
    const backend = createBackend();
    const shareToken = "complete-detail-token-0000000";
    await seedPublished(backend, shareToken);
    const questions = await loadQuestions(backend, shareToken);
    const savedQuestion = questions.find(
      (question) => question.content.kind === "multiple_choice",
    );
    if (!savedQuestion || savedQuestion.content.kind !== "multiple_choice") {
      throw new Error("expected a multiple choice question");
    }
    const resumeToken = "resume-complete-detail-0000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken,
      resumeToken,
    });

    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: savedQuestion._id,
      response: { kind: "choice", choiceIndex: 0 },
      stats: { activeMs: 12_000, lookupCount: 2, revisionCount: 1 },
    });

    const detail = await backend.query(api.submissions.detail, {
      submissionId: started.submissionId,
    });
    expect(detail?.answers.map((answer) => answer.questionId)).toEqual(
      questions.map((question) => question._id),
    );
    expect(detail?.answers.find((answer) => answer.questionId === savedQuestion._id)).toMatchObject(
      {
        answered: true,
        response: { kind: "choice", choiceIndex: 0 },
        instructions: savedQuestion.instructions,
        publicContent: {
          kind: "multiple_choice",
          choices: savedQuestion.content.choices,
        },
        responseText: "By the time we got to the station, the train had already left.",
        activeMs: 12_000,
        lookupCount: 2,
        revisionCount: 1,
      },
    );
    const unanswered = detail?.answers.find(
      (answer) => answer.questionId !== savedQuestion._id,
    );
    expect(unanswered).toMatchObject({
      answered: false,
      responseText: "",
      activeMs: 0,
      lookupCount: 0,
      revisionCount: 0,
    });
    expect(unanswered).not.toHaveProperty("correctness");
    expect(unanswered).not.toHaveProperty("pointsAwarded");
    expect(unanswered).not.toHaveProperty("response");
  });

  test("accepts a blank answer that differs only by case and spacing", async () => {
    const backend = createBackend();
    await seedPublished(backend, "casing-token-000000000000");
    const questions = await loadQuestions(backend, "casing-token-000000000000");
    const fillBlank = questions.find((q) => q.content.kind === "fill_blank");
    if (!fillBlank) throw new Error("expected a fill_blank question");
    const resumeToken = "resume-casing-00000000000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken: "casing-token-000000000000",
      resumeToken,
    });

    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: fillBlank._id,
      response: { kind: "blanks", values: [" The ", "THE", "the"] },
      stats: NEUTRAL_STATS,
    });
    await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });

    const detail = await backend.query(api.submissions.detail, {
      submissionId: started.submissionId,
    });
    expect(detail?.answers.find((answer) => answer.questionId === fillBlank._id)).toMatchObject({
      answered: true,
      correctness: "correct",
    });
  });

  test("rejects a saved answer with the wrong resume token", async () => {
    const backend = createBackend();
    await seedPublished(backend, "token-guard-000000000000");
    const questions = await loadQuestions(backend, "token-guard-000000000000");
    const started = await backend.mutation(api.submissions.start, {
      shareToken: "token-guard-000000000000",
      resumeToken: "resume-guard-000000000000",
    });

    await expect(
      backend.mutation(api.submissions.saveAnswer, {
        submissionId: started.submissionId,
        resumeToken: "attacker-token-0000000000",
        questionId: questions[0]!._id,
        response: { kind: "choice", choiceIndex: 0 },
        stats: NEUTRAL_STATS,
      }),
    ).rejects.toThrow(/invalid submission token/i);
  });

  test("grades a pending written answer and recalculates submission totals", async () => {
    const backend = createBackend();
    const shareToken = "review-token-000000000000";
    await seedPublished(backend, shareToken);
    const questions = await loadQuestions(backend, shareToken);
    const writtenQuestion = questions.find((question) => question.content.kind === "open_response");
    if (!writtenQuestion) throw new Error("expected an open response question");
    const resumeToken = "resume-review-00000000000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken,
      resumeToken,
    });

    for (const question of questions) {
      await backend.mutation(api.submissions.saveAnswer, {
        submissionId: started.submissionId,
        resumeToken,
        questionId: question._id,
        response: correctResponseFor(question),
        stats: NEUTRAL_STATS,
      });
    }
    const submitted = await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });
    expect(submitted).toMatchObject({ score: 9, maxAutoScore: 9, pendingReviewCount: 1 });

    await expect(
      backend.mutation(api.submissions.gradePendingAnswer, {
        submissionId: started.submissionId,
        questionId: writtenQuestion._id,
        correctness: "partial",
        pointsAwarded: writtenQuestion.points + 1,
      }),
    ).rejects.toThrow(/between 0 and 4/i);

    const reviewed = await backend.mutation(api.submissions.gradePendingAnswer, {
      submissionId: started.submissionId,
      questionId: writtenQuestion._id,
      correctness: "partial",
      pointsAwarded: 2,
    });
    expect(reviewed).toEqual({ score: 11, maxScore: 13, pendingReviewCount: 0 });

    const detail = await backend.query(api.submissions.detail, {
      submissionId: started.submissionId,
    });
    const reviewedAnswer = detail?.answers.find(
      (answer) => answer.questionId === writtenQuestion._id,
    );
    expect(detail).toMatchObject({ score: 11, maxAutoScore: 13 });
    expect(reviewedAnswer).toMatchObject({ correctness: "partial", pointsAwarded: 2 });
    expect((await backend.query(api.feed.inbox))[0]).toMatchObject({
      score: 11,
      maxAutoScore: 13,
      pendingReviewCount: 0,
    });

    await expect(
      backend.mutation(api.submissions.gradePendingAnswer, {
        submissionId: started.submissionId,
        questionId: writtenQuestion._id,
        correctness: "correct",
        pointsAwarded: writtenQuestion.points,
      }),
    ).rejects.toThrow(/no longer awaiting review/i);
  });
});

describe("teacher feed", () => {
  test("aggregates telemetry and surfaces only genuinely missed skills", async () => {
    const backend = createBackend();
    await seedPublished(backend, "feed-token-00000000000000");
    const questions = await loadQuestions(backend, "feed-token-00000000000000");
    const resumeToken = "resume-feed-000000000000";
    const started = await backend.mutation(api.submissions.start, {
      shareToken: "feed-token-00000000000000",
      resumeToken,
    });

    const multipleChoice = questions.find((q) => q.content.kind === "multiple_choice");
    const openResponse = questions.find((q) => q.content.kind === "open_response");
    if (!multipleChoice || !openResponse) throw new Error("expected both question kinds");

    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: multipleChoice._id,
      response: { kind: "choice", choiceIndex: 2 },
      stats: { activeMs: 95_000, lookupCount: 3, revisionCount: 5 },
    });
    await backend.mutation(api.submissions.saveAnswer, {
      submissionId: started.submissionId,
      resumeToken,
      questionId: openResponse._id,
      response: { kind: "text", text: "My attempt." },
      stats: { activeMs: 25_000, lookupCount: 1, revisionCount: 2 },
    });
    await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });

    const inbox = await backend.query(api.feed.inbox);
    expect(inbox[0]).toMatchObject({
      studentName: "Mira Petrova",
      status: "submitted",
      activeMinutes: 2,
      lookupCount: 4,
      pendingReviewCount: 1,
    });
    expect(inbox[0]?.strugglingSkills.toSorted()).toEqual(["past-perfect", "sequencing"]);
  });

  test("lists submitted work that still has no AI summary", async () => {
    const backend = createBackend();
    const submissionId = await submitOneAnswer(backend, "summary-token-00000000000");

    expect(await backend.query(api.feed.awaitingSummary)).toHaveLength(1);

    await backend.mutation(api.submissions.attachAiSummary, {
      submissionId,
      summary: {
        text: "Confident on articles, shaky on past perfect.",
        strengths: ["articles"],
        focusAreas: ["past perfect"],
        generatedAt: 1,
      },
    });

    expect(await backend.query(api.feed.awaitingSummary)).toHaveLength(0);
    const inbox = await backend.query(api.feed.inbox);
    expect(inbox[0]?.aiSummary?.focusAreas).toEqual(["past perfect"]);
  });

  test("builds a summary prompt payload with per-question evidence", async () => {
    const backend = createBackend();
    const submissionId = await submitOneAnswer(backend, "prompt-token-000000000000");
    const input = await backend.query(api.feed.summaryInput, { submissionId });

    expect(input).toMatchObject({ studentName: "Mira Petrova" });
    expect(input?.questions[0]).toMatchObject({
      correctness: "incorrect",
      lookupCount: 3,
      revisionCount: 5,
    });
    expect(input?.questions[0]?.correctAnswer).toBe(
      "By the time we got to the station, the train had already left.",
    );
  });
});

describe("insights", () => {
  test("reports skill accuracy and per-question cost", async () => {
    const backend = createBackend();
    await submitOneAnswer(backend, "insight-token-00000000000");

    const skills = await backend.query(api.dashboard.skillMastery);
    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: "past-perfect", accuracy: 0, attempts: 1 }),
      ]),
    );

    const questions = await backend.query(api.dashboard.questionInsights);
    expect(questions[0]).toMatchObject({
      accuracy: 0,
      averageSeconds: 95,
      averageLookups: 3,
      averageRevisions: 5,
    });
    expect(questions[0]).not.toHaveProperty("lookupRate");

    const overview = await backend.query(api.dashboard.overview);
    expect(overview).toMatchObject({ submittedCount: 1, completionRate: 100 });
  });

  test("attributes each skill to students from strongest to weakest", async () => {
    const backend = createBackend();
    const struggling = await submitMultipleChoiceAnswer(
      backend,
      "weak-skill-token-0000000000",
      2,
    );
    const outperforming = await submitMultipleChoiceAnswer(
      backend,
      "strong-skill-token-00000000",
      0,
    );
    await backend.run(async (ctx) => {
      await ctx.db.patch("students", struggling.studentId, { name: "Needs attention" });
      await ctx.db.patch("students", outperforming.studentId, { name: "Outperforming" });
    });

    const skills = await backend.query(api.dashboard.skillMastery);
    const pastPerfect = skills.find((skill) => skill.skill === "past-perfect");

    expect(pastPerfect).toMatchObject({ accuracy: 50, attempts: 2 });
    expect(pastPerfect?.students).toEqual([
      {
        studentId: outperforming.studentId,
        name: "Outperforming",
        accuracy: 100,
        attempts: 1,
      },
      {
        studentId: struggling.studentId,
        name: "Needs attention",
        accuracy: 0,
        attempts: 1,
      },
    ]);
  });

  test("keeps both strongest and weakest students when skill attribution is capped", async () => {
    const backend = createBackend();
    const students = await seedSkillMasteryRange(
      backend,
      "balanced-skill-token-0000000",
    );

    const skills = await backend.query(api.dashboard.skillMastery);
    const pastPerfect = skills.find((skill) => skill.skill === "past-perfect");

    expect(pastPerfect?.students).toHaveLength(6);
    expect(pastPerfect?.students.map((student) => student.studentId)).toEqual([
      students[7]?.studentId,
      students[6]?.studentId,
      students[5]?.studentId,
      students[0]?.studentId,
      students[1]?.studentId,
      students[2]?.studentId,
    ]);
    expect(pastPerfect?.students.map((student) => student.accuracy)).toEqual([
      100, 86, 71, 0, 14, 29,
    ]);
  });
});

async function seedSkillMasteryRange(
  backend: ReturnType<typeof createBackend>,
  shareToken: string,
) {
  await seedPublished(backend, shareToken);
  return backend.run(async (ctx) => {
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", shareToken))
      .unique();
    if (!assignment) throw new Error("expected a published assignment");
    const questions = await ctx.db
      .query("assignmentQuestions")
      .withIndex("by_assignmentId_and_order", (q) => q.eq("assignmentId", assignment._id))
      .take(4);
    const question = questions.find((item) => item.skillTags.includes("past-perfect"));
    if (!question) throw new Error("expected a past-perfect question");

    const students = [];
    const attemptCount = 7;
    for (let studentIndex = 0; studentIndex <= attemptCount; studentIndex += 1) {
      const name = `Student ${studentIndex}`;
      const studentId = await ctx.db.insert("students", {
        name,
        contextNotes: "Skill attribution fixture",
        status: "active",
        createdAt: studentIndex,
      });
      students.push({ studentId, name });

      for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
        const isCorrect = attemptIndex < studentIndex;
        const submissionId = await ctx.db.insert("submissions", {
          assignmentId: assignment._id,
          studentId,
          studentName: name,
          resumeToken: `balanced-${studentIndex}-${attemptIndex}`,
          status: "submitted",
          startedAt: attemptIndex,
          submittedAt: attemptIndex,
          score: isCorrect ? question.points : 0,
          maxAutoScore: question.points,
        });
        await ctx.db.insert("answers", {
          submissionId,
          questionId: question._id,
          response: { kind: "choice", choiceIndex: isCorrect ? 0 : 1 },
          correctness: isCorrect ? "correct" : "incorrect",
          pointsAwarded: isCorrect ? question.points : 0,
          activeMs: 1_000,
          lookupCount: 0,
          revisionCount: 0,
          answeredAt: attemptIndex,
        });
      }
    }
    return students;
  });
}

async function createUnpublishedDraft(backend: ReturnType<typeof createBackend>) {
  const aiJobId = await backend.mutation(api.aiJobs.createHomeworkGeneration, {
    requestId: "discard-draft-job",
    title: "Discardable draft",
    inputSnapshot: "{}",
  });
  await backend.mutation(api.aiJobs.markRunning, { aiJobId });
  const homeworkDraftId = await backend.mutation(api.aiJobs.completeHomeworkGeneration, {
    aiJobId,
    draft: {
      title: "Discardable draft",
      summary: "A generated draft that the teacher no longer needs.",
      estimatedMinutes: 10,
      learningObjectives: ["Choose the right answer"],
      questions: [
        {
          id: "discard-question-1",
          type: "multiple_choice",
          prompt: "Choose one.",
          instructions: "Select the correct option.",
          content: {
            kind: "multiple_choice",
            choices: ["Correct", "Incorrect"],
            correctChoice: 0,
          },
          skillTags: ["draft-skill"],
          points: 1,
          difficulty: "easy",
          explanation: "The first option is correct.",
        },
        {
          id: "discard-question-2",
          type: "open_response",
          prompt: "Write one sentence.",
          instructions: "Answer briefly.",
          content: { kind: "open_response" },
          skillTags: ["draft-skill"],
          points: 1,
          difficulty: "easy",
          explanation: "Any relevant sentence can be reviewed.",
        },
      ],
    },
  });
  return { aiJobId, homeworkDraftId };
}

async function submitMultipleChoiceAnswer(
  backend: ReturnType<typeof createBackend>,
  shareToken: string,
  choiceIndex: number,
) {
  const { studentId } = await seedPublished(backend, shareToken);
  const questions = await loadQuestions(backend, shareToken);
  const multipleChoice = questions.find((question) => question.content.kind === "multiple_choice");
  if (!multipleChoice) throw new Error("expected a multiple choice question");
  const resumeToken = `resume-${shareToken}`.slice(0, 30);
  const started = await backend.mutation(api.submissions.start, { shareToken, resumeToken });

  await backend.mutation(api.submissions.saveAnswer, {
    submissionId: started.submissionId,
    resumeToken,
    questionId: multipleChoice._id,
    response: { kind: "choice", choiceIndex },
    stats: { activeMs: 95_000, lookupCount: 3, revisionCount: 5 },
  });
  await backend.mutation(api.submissions.submit, {
    submissionId: started.submissionId,
    resumeToken,
  });
  return { submissionId: started.submissionId, studentId };
}

async function submitOneAnswer(
  backend: ReturnType<typeof createBackend>,
  shareToken: string,
): Promise<Id<"submissions">> {
  const result = await submitMultipleChoiceAnswer(backend, shareToken, 2);
  return result.submissionId;
}

type PublicQuestion = Awaited<ReturnType<typeof loadQuestions>>[number];

function correctResponseFor(question: PublicQuestion) {
  if (question.content.kind === "multiple_choice") {
    return { kind: "choice" as const, choiceIndex: 0 };
  }
  if (question.content.kind === "fill_blank") {
    return {
      kind: "blanks" as const,
      values: Array.from({ length: question.content.blankCount }, () => "the"),
    };
  }
  if (question.content.kind === "matching") {
    const correctByLeft: Record<string, string> = {
      platform: "the raised area beside the track",
      delayed: "later than the planned time",
      luggage: "the bags you carry when you travel",
    };
    return {
      kind: "matches" as const,
      rights: question.content.lefts.map((left) => correctByLeft[left] ?? ""),
    };
  }
  return { kind: "text" as const, text: "My written answer." };
}
