import { convexQuery } from "@convex-dev/react-query";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { getSharedQueryClient } from "./convex-query-client";

/**
 * Fetches a page's data on the intent to open it — a pointer entering a row, or focus
 * reaching it — so the click lands on content rather than on a skeleton.
 *
 * This used to hold its own pool of Convex subscriptions, capped and expired by hand,
 * entirely separate from the cache the screens actually read from. Now it warms the one
 * cache, so a warmed query and a rendered query are the same entry: there is nothing to
 * keep in step, and nothing to expire twice.
 */
export function prewarmStudentHistory(studentId: Id<"students">) {
  prefetch(convexQuery(api.students.get, { studentId }));
  prefetch(convexQuery(api.students.history, { studentId }));
}

export function prewarmSubmissionDetail(submissionId: Id<"submissions">) {
  prefetch(convexQuery(api.submissions.detail, { submissionId }));
}

export function prewarmHomeworkDraft(homeworkDraftId: Id<"homeworkDrafts">) {
  prefetch(convexQuery(api.assignments.getDraft, { homeworkDraftId }));
}

/**
 * `convexQuery` describes its key as a fixed tuple, which does not narrow to the readonly
 * key `prefetchQuery` accepts; the shapes agree at runtime, so the options pass through.
 */
function prefetch(options: { queryKey: readonly unknown[]; queryFn?: unknown }) {
  // A warm-up is a guess about where the teacher is going; a failed guess must not
  // surface as an error anywhere.
  void getSharedQueryClient()
    .prefetchQuery(options as Parameters<ReturnType<typeof getSharedQueryClient>["prefetchQuery"]>[0])
    .catch(() => undefined);
}
