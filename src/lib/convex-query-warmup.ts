import type { ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionArgs, type FunctionReference } from "convex/server";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const DEFAULT_WARMUP_DURATION_MS = 5 * 60 * 1_000;
/**
 * Running the pointer down a long list warms a row at a time, so the pool is
 * capped and evicts the least recently reached for — the same ceiling the query
 * cache itself keeps on idle entries, an order of magnitude smaller because
 * these are guesses rather than pages the teacher actually opened.
 */
const MAXIMUM_WARM_QUERIES = 24;
type WarmQuery = { timer: ReturnType<typeof setTimeout>; unsubscribe: () => void };
const warmQueries = new WeakMap<ConvexReactClient, Map<string, WarmQuery>>();

export function prewarmStudentHistory(
  convex: ConvexReactClient,
  studentId: Id<"students">,
  durationMs = DEFAULT_WARMUP_DURATION_MS,
) {
  prewarmQuery(convex, api.students.get, { studentId }, durationMs);
  prewarmQuery(convex, api.students.history, { studentId }, durationMs);
}

export function prewarmSubmissionDetail(
  convex: ConvexReactClient,
  submissionId: Id<"submissions">,
  durationMs = DEFAULT_WARMUP_DURATION_MS,
) {
  prewarmQuery(convex, api.submissions.detail, { submissionId }, durationMs);
}

export function prewarmHomeworkDraft(
  convex: ConvexReactClient,
  homeworkDraftId: Id<"homeworkDrafts">,
  durationMs = DEFAULT_WARMUP_DURATION_MS,
) {
  prewarmQuery(convex, api.assignments.getDraft, { homeworkDraftId }, durationMs);
}

function prewarmQuery<Query extends FunctionReference<"query">>(
  convex: ConvexReactClient,
  query: Query,
  args: FunctionArgs<Query>,
  durationMs: number,
) {
  const queries = warmQueries.get(convex) ?? new Map<string, WarmQuery>();
  warmQueries.set(convex, queries);
  const key = `${getFunctionName(query)}:${JSON.stringify(args)}`;
  const existing = queries.get(key);
  if (existing) clearTimeout(existing.timer);
  const unsubscribe = existing?.unsubscribe ?? convex.watchQuery(query, args).onUpdate(() => {});
  const timer = setTimeout(() => {
    unsubscribe();
    queries.delete(key);
  }, durationMs);
  // Re-inserted rather than updated in place, so the map stays in reach order.
  queries.delete(key);
  queries.set(key, { timer, unsubscribe });
  while (queries.size > MAXIMUM_WARM_QUERIES) {
    const [oldestKey, oldest] = [...queries.entries()][0]!;
    clearTimeout(oldest.timer);
    oldest.unsubscribe();
    queries.delete(oldestKey);
  }
}

export function clearQueryWarmups(convex: ConvexReactClient) {
  const queries = warmQueries.get(convex);
  if (!queries) return;
  for (const query of queries.values()) {
    clearTimeout(query.timer);
    query.unsubscribe();
  }
  warmQueries.delete(convex);
}
