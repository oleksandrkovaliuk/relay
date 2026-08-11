import type { ClaudeRuntimeEvent } from "@/shared/claude";

export type ClaudeActivityKind =
  | "request"
  | "runtime"
  | "tool"
  | "streaming"
  | "authentication"
  | "completion"
  | "cancelled"
  | "failed";

export type ClaudeActivityUpdate = {
  kind: ClaudeActivityKind;
  /** The action, in normal weight. */
  label: string;
  /** The technical tail, rendered dimmed after the label. */
  detail?: string;
};

export type ClaudeActivityEntry = ClaudeActivityUpdate & {
  id: number;
  elapsedMilliseconds: number;
};

export function describeClaudeRuntimeEvent(event: ClaudeRuntimeEvent): ClaudeActivityUpdate {
  if (event.type === "started") {
    return { kind: "runtime", label: "Started Claude session" };
  }
  if (event.type === "tool_started") {
    const isMiroTool = event.toolName.startsWith("mcp__miro__");
    return {
      kind: "tool",
      label: isMiroTool ? "Reading the Miro board" : "Running tool",
      detail: formatToolName(event.toolName),
    };
  }
  if (event.type === "authentication_required") {
    const isMiro = event.provider.toLowerCase().includes("miro");
    return {
      kind: "authentication",
      label: isMiro ? "Miro sign-in required" : "Tool sign-in required",
      detail: event.provider,
    };
  }
  if (event.type === "text_delta") {
    return { kind: "streaming", label: "Writing the draft" };
  }
  if (event.type === "completed") {
    return { kind: "completion", label: "Draft generated" };
  }
  if (event.type === "cancelled") {
    return { kind: "cancelled", label: "Generation stopped" };
  }
  return { kind: "failed", label: "Generation failed" };
}

/**
 * A long generation can emit hundreds of tool events. The panel is a scrollable
 * log, not an audit trail, so the oldest entries are dropped rather than growing
 * the array — and the re-render cost with it — without limit.
 */
const MAXIMUM_ACTIVITY_ENTRIES = 200;

export function appendClaudeActivity(
  currentEntries: ClaudeActivityEntry[],
  update: ClaudeActivityUpdate,
  id: number,
  elapsedMilliseconds: number,
) {
  const latestEntry = currentEntries.at(-1);
  const isRepeatedStreamingUpdate =
    update.kind === "streaming" && latestEntry?.kind === "streaming";
  if (isRepeatedStreamingUpdate) {
    // Streaming is one row, not hundreds — but it is replaced rather than
    // ignored, so its detail can report how much has been written. A row that
    // never changes for two minutes reads as a hang.
    if (latestEntry.detail === update.detail) return currentEntries;
    return [
      ...currentEntries.slice(0, -1),
      { ...latestEntry, ...update, elapsedMilliseconds },
    ];
  }

  const appended = [...currentEntries, { ...update, id, elapsedMilliseconds }];
  return appended.length > MAXIMUM_ACTIVITY_ENTRIES
    ? appended.slice(-MAXIMUM_ACTIVITY_ENTRIES)
    : appended;
}

function formatToolName(toolName: string) {
  const withoutMiroPrefix = toolName.replace(/^mcp__miro__/, "miro · ");
  const readableName = withoutMiroPrefix.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  return readableName || "external tool";
}

/**
 * How far the draft has got, read from the JSON as it streams. Every activity in
 * the structured output carries exactly one `"prompt"` key, so counting them is a
 * reliable progress signal without parsing incomplete JSON.
 */
export function countGeneratedActivities(streamedText: string) {
  return streamedText.match(/"prompt"\s*:/g)?.length ?? 0;
}

export function describeDraftProgress(streamedText: string) {
  const activityCount = countGeneratedActivities(streamedText);
  if (activityCount === 0) return "Planning the set";
  return `${activityCount} ${activityCount === 1 ? "activity" : "activities"} written`;
}
