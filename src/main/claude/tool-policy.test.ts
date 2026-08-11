import { describe, expect, it } from "vitest";

import { allowReadOnlyMiroTools, isReadOnlyMiroTool } from "./tool-policy";

describe("Miro tool policy", () => {
  it("allows read-only Miro tools", () => {
    expect(isReadOnlyMiroTool("mcp__miro__board_items_list")).toBe(true);
    expect(isReadOnlyMiroTool("mcp__miro__context_get")).toBe(true);
  });

  it("rejects mutating and non-Miro tools", () => {
    expect(isReadOnlyMiroTool("mcp__miro__create_board")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__miro__update_document")).toBe(false);
    expect(isReadOnlyMiroTool("Bash")).toBe(false);
  });

  it("returns a deny decision for a write attempt", async () => {
    const result = await allowReadOnlyMiroTools(
      "mcp__miro__delete_board",
      {},
      {
        signal: new AbortController().signal,
        toolUseID: "tool-1",
        requestId: "request-1",
      },
    );

    expect(result).toMatchObject({ behavior: "deny" });
  });
});
