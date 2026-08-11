import type { ConvexReactClient } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const DEFAULT_WARMUP_DURATION_MS = 5 * 60 * 1_000;

export function prewarmStudentHistory(
  convex: ConvexReactClient,
  studentId: Id<"students">,
  durationMs = DEFAULT_WARMUP_DURATION_MS,
) {
  convex.prewarmQuery({
    query: api.students.history,
    args: { studentId },
    extendSubscriptionFor: durationMs,
  });
}

export function prewarmSubmissionDetail(
  convex: ConvexReactClient,
  submissionId: Id<"submissions">,
  durationMs = DEFAULT_WARMUP_DURATION_MS,
) {
  convex.prewarmQuery({
    query: api.submissions.detail,
    args: { submissionId },
    extendSubscriptionFor: durationMs,
  });
}
