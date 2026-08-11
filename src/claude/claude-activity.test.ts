import { describe, expect, it } from "vitest";

import {
  appendClaudeActivity,
  describeClaudeRuntimeEvent,
  type ClaudeActivityEntry,
} from "@/claude/claude-activity";

describe("Claude builder activity", () => {
  it("maps runtime events without exposing streamed content or raw failure details", () => {
    expect(
      describeClaudeRuntimeEvent({
        type: "text_delta",
        requestId: "request-1",
        text: "private streamed output",
      }),
    ).toEqual({ kind: "streaming", label: "Writing the draft" });
    expect(
      describeClaudeRuntimeEvent({
        type: "failed",
        requestId: "request-1",
        message: '{"raw":"payload"}',
      }),
    ).toEqual({ kind: "failed", label: "Generation failed" });
  });

  it("splits tool activity into a readable action and a dimmable technical tail", () => {
    expect(
      describeClaudeRuntimeEvent({
        type: "tool_started",
        requestId: "request-1",
        toolName: "mcp__miro__get_board_items",
      }),
    ).toEqual({
      kind: "tool",
      label: "Reading the Miro board",
      detail: "miro · get board items",
    });
  });

  it("names an unfamiliar tool generically and keeps its identifier in the tail", () => {
    expect(
      describeClaudeRuntimeEvent({
        type: "tool_started",
        requestId: "request-1",
        toolName: "some_other_tool",
      }),
    ).toEqual({ kind: "tool", label: "Running tool", detail: "some other tool" });
  });

  it("deduplicates streaming noise while preserving the complete activity history", () => {
    let entries: ClaudeActivityEntry[] = [];
    entries = appendClaudeActivity(entries, { kind: "streaming", label: "Streaming" }, 1, 100);
    entries = appendClaudeActivity(entries, { kind: "streaming", label: "Streaming" }, 2, 200);
    expect(entries).toHaveLength(1);

    for (let id = 3; id < 12; id += 1) {
      entries = appendClaudeActivity(entries, { kind: "tool", label: `Tool ${id}` }, id, id * 100);
    }

    expect(entries).toHaveLength(10);
    expect(entries[0]).toMatchObject({ label: "Streaming", elapsedMilliseconds: 100 });
    expect(entries.at(-1)?.label).toBe("Tool 11");
  });
});
