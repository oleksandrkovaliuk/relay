import type { ConvexReactClient } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  clearQueryWarmups,
  prewarmHomeworkDraft,
  prewarmStudentHistory,
  prewarmSubmissionDetail,
} from "./convex-query-warmup";

function createConvexClientMock() {
  const unsubscribe = vi.fn();
  const watchQuery = vi.fn(() => ({ onUpdate: () => unsubscribe }));
  const convex = { watchQuery } as unknown as ConvexReactClient;
  return { convex, watchQuery, unsubscribe };
}

afterEach(() => vi.useRealTimers());

describe("Convex query warmup", () => {
  it("warms the student name and history and deduplicates hover/focus", () => {
    vi.useFakeTimers();
    const { convex, watchQuery, unsubscribe } = createConvexClientMock();
    const studentId = "student-id" as Id<"students">;
    prewarmStudentHistory(convex, studentId);
    expect(watchQuery).toHaveBeenCalledWith(api.students.get, { studentId });
    expect(watchQuery).toHaveBeenCalledWith(api.students.history, { studentId });
    vi.advanceTimersByTime(60_000);
    prewarmStudentHistory(convex, studentId);
    expect(watchQuery).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(299_999);
    expect(unsubscribe).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("warms the draft a homework row opens", () => {
    vi.useFakeTimers();
    const { convex, watchQuery, unsubscribe } = createConvexClientMock();
    const homeworkDraftId = "draft-id" as Id<"homeworkDrafts">;
    prewarmHomeworkDraft(convex, homeworkDraftId, 45_000);
    expect(watchQuery).toHaveBeenCalledWith(api.assignments.getDraft, { homeworkDraftId });
    prewarmHomeworkDraft(convex, homeworkDraftId, 45_000);
    expect(watchQuery).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(45_000);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("drops the least recently reached row when a long list is swept", () => {
    vi.useFakeTimers();
    const { convex, watchQuery, unsubscribe } = createConvexClientMock();
    for (let row = 0; row < 24; row += 1) {
      prewarmSubmissionDetail(convex, `submission-${row}` as Id<"submissions">);
    }
    expect(watchQuery).toHaveBeenCalledTimes(24);
    expect(unsubscribe).not.toHaveBeenCalled();

    // Reaching for the first row again makes it the newest, so the second is
    // the one the twenty-fifth row evicts.
    prewarmSubmissionDetail(convex, "submission-0" as Id<"submissions">);
    prewarmSubmissionDetail(convex, "submission-24" as Id<"submissions">);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    prewarmSubmissionDetail(convex, "submission-1" as Id<"submissions">);
    expect(watchQuery).toHaveBeenCalledTimes(26);

    clearQueryWarmups(convex);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps different submissions separate and releases them at sign-out", () => {
    vi.useFakeTimers();
    const { convex, watchQuery, unsubscribe } = createConvexClientMock();
    prewarmSubmissionDetail(convex, "first" as Id<"submissions">, 45_000);
    prewarmSubmissionDetail(convex, "second" as Id<"submissions">, 45_000);
    expect(watchQuery).toHaveBeenCalledTimes(2);
    clearQueryWarmups(convex);
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    prewarmSubmissionDetail(convex, "first" as Id<"submissions">, 45_000);
    expect(watchQuery).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(45_000);
    expect(unsubscribe).toHaveBeenCalledTimes(3);
  });
});
