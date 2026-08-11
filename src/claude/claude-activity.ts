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

export function appendClaudeActivity(
  currentEntries: ClaudeActivityEntry[],
  update: ClaudeActivityUpdate,
  id: number,
  elapsedMilliseconds: number,
) {
  const latestEntry = currentEntries.at(-1);
  const isRepeatedStreamingUpdate =
    update.kind === "streaming" && latestEntry?.kind === "streaming";
  if (isRepeatedStreamingUpdate) return currentEntries;

  return [...currentEntries, { ...update, id, elapsedMilliseconds }];
}

function formatToolName(toolName: string) {
  const withoutMiroPrefix = toolName.replace(/^mcp__miro__/, "miro · ");
  const readableName = withoutMiroPrefix.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  return readableName || "external tool";
}
