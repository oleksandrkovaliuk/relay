import type { ConvexReactClient } from "convex/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { prewarmStudentHistory, prewarmSubmissionDetail } from "./convex-query-warmup";

function createConvexClientMock() {
  const prewarmQuery = vi.fn();
  const convex = { prewarmQuery } as unknown as ConvexReactClient;
  return { convex, prewarmQuery };
}

describe("Convex query warmup", () => {
  it("keeps student history reactive for five minutes by default", () => {
    const { convex, prewarmQuery } = createConvexClientMock();
    const studentId = "student-id" as Id<"students">;

    prewarmStudentHistory(convex, studentId);

    expect(prewarmQuery).toHaveBeenCalledWith({
      query: api.students.history,
      args: { studentId },
      extendSubscriptionFor: 300_000,
    });
  });

  it("can keep a submission detail warm for a caller-selected duration", () => {
    const { convex, prewarmQuery } = createConvexClientMock();
    const submissionId = "submission-id" as Id<"submissions">;

    prewarmSubmissionDetail(convex, submissionId, 45_000);

    expect(prewarmQuery).toHaveBeenCalledWith({
      query: api.submissions.detail,
      args: { submissionId },
      extendSubscriptionFor: 45_000,
    });
  });
});
