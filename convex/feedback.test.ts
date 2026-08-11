/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createBackend() {
  return convexTest(schema, modules);
}

async function createSubmission(
  backend: ReturnType<typeof createBackend>,
  tokenPrefix: string,
  isSubmitted = true,
) {
  const shareToken = `${tokenPrefix}-share-token-000000000`;
  const resumeToken = `${tokenPrefix}-resume-token-00000000`;
  const { studentId } = await backend.mutation(internal.seed.demoHomework, { shareToken });
  const started = await backend.mutation(api.submissions.start, { shareToken, resumeToken });
  if (isSubmitted) {
    await backend.mutation(api.submissions.submit, {
      submissionId: started.submissionId,
      resumeToken,
    });
  }
  return { ...started, studentId, shareToken, resumeToken };
}

describe("submission feedback", () => {
  test("requires the submission resume token for student reads and writes", async () => {
    const backend = createBackend();
    const submission = await createSubmission(backend, "feedback-auth");

    await expect(
      backend.mutation(api.feedback.save, {
        submissionId: submission.submissionId,
        resumeToken: "invalid-resume-token-000000",
        rating: 4,
        comment: "Useful practice.",
      }),
    ).rejects.toThrow(/invalid submission token/i);
    await expect(
      backend.query(api.feedback.getMine, {
        submissionId: submission.submissionId,
        resumeToken: "invalid-resume-token-000000",
      }),
    ).rejects.toThrow(/invalid submission token/i);

    const feedbackItems = await backend.run(async (ctx) =>
      ctx.db.query("submissionFeedback").take(2),
    );
    expect(feedbackItems).toEqual([]);
  });

  test("rejects feedback before the homework is submitted", async () => {
    const backend = createBackend();
    const submission = await createSubmission(backend, "feedback-early", false);

    await expect(
      backend.mutation(api.feedback.save, {
        submissionId: submission.submissionId,
        resumeToken: submission.resumeToken,
        rating: 5,
      }),
    ).rejects.toThrow(/only be added after homework is submitted/i);
  });

  test("validates the rating and limits the trimmed comment to 500 characters", async () => {
    const backend = createBackend();
    const submission = await createSubmission(backend, "feedback-validation");

    for (const rating of [0, 6, 2.5]) {
      await expect(
        backend.mutation(api.feedback.save, {
          submissionId: submission.submissionId,
          resumeToken: submission.resumeToken,
          rating,
        }),
      ).rejects.toThrow(/whole number between 1 and 5/i);
    }
    await expect(
      backend.mutation(api.feedback.save, {
        submissionId: submission.submissionId,
        resumeToken: submission.resumeToken,
        rating: 3,
        comment: `  ${"x".repeat(501)}  `,
      }),
    ).rejects.toThrow(/500 characters or fewer/i);
  });

  test("upserts one normalized record and makes identical retries no-ops", async () => {
    const backend = createBackend();
    const submission = await createSubmission(backend, "feedback-upsert");

    const first = await backend.mutation(api.feedback.save, {
      submissionId: submission.submissionId,
      resumeToken: submission.resumeToken,
      rating: 4,
      comment: "  The matching task was clear.  ",
    });
    const retried = await backend.mutation(api.feedback.save, {
      submissionId: submission.submissionId,
      resumeToken: submission.resumeToken,
      rating: 4,
      comment: "The matching task was clear.",
    });
    expect(retried).toEqual(first);

    const updated = await backend.mutation(api.feedback.save, {
      submissionId: submission.submissionId,
      resumeToken: submission.resumeToken,
      rating: 5,
      comment: "   ",
    });
    expect(updated).toMatchObject({ rating: 5, createdAt: first.createdAt });
    expect(updated).not.toHaveProperty("comment");

    const feedbackItems = await backend.run(async (ctx) =>
      ctx.db
        .query("submissionFeedback")
        .withIndex("by_submissionId", (index) =>
          index.eq("submissionId", submission.submissionId),
        )
        .take(2),
    );
    expect(feedbackItems).toHaveLength(1);
    expect(
      await backend.query(api.feedback.getMine, {
        submissionId: submission.submissionId,
        resumeToken: submission.resumeToken,
      }),
    ).toEqual(updated);
  });

  test("surfaces safe feedback in teacher detail, history, feed, and aggregates", async () => {
    const backend = createBackend();
    const submission = await createSubmission(backend, "feedback-teacher");
    await backend.mutation(api.feedback.save, {
      submissionId: submission.submissionId,
      resumeToken: submission.resumeToken,
      rating: 4,
      comment: "I liked the short steps.",
    });

    const detail = await backend.query(api.submissions.detail, {
      submissionId: submission.submissionId,
    });
    const studentHistory = await backend.query(api.students.history, {
      studentId: submission.studentId,
    });
    const feed = await backend.query(api.feed.inbox);
    const assignments = await backend.query(api.assignments.listPublished);
    const overview = await backend.query(api.dashboard.overview);

    const expectedFeedback = {
      rating: 4,
      comment: "I liked the short steps.",
    };
    expect(detail?.feedback).toMatchObject(expectedFeedback);
    expect(studentHistory[0]?.feedback).toMatchObject(expectedFeedback);
    expect(feed[0]?.feedback).toMatchObject(expectedFeedback);
    expect(assignments[0]).toMatchObject({
      feedbackCount: 1,
      averageRating: 4,
      latestFeedback: {
        submissionId: submission.submissionId,
        studentName: "Mira Petrova",
        ...expectedFeedback,
      },
    });
    expect(overview).toMatchObject({ ratingCount: 1, averageRating: 4 });

    const teacherPayload = JSON.stringify({ detail, studentHistory, feed, assignments, overview });
    expect(teacherPayload).not.toContain(submission.resumeToken);
    expect(teacherPayload).not.toContain("resumeToken");
  });
});
