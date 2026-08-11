import { describe, expect, it } from "vitest";

import { allowReadOnlyMiroTools, isBoardAttachTool, isReadOnlyMiroTool } from "./tool-policy";

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

describe("isBoardAttachTool", () => {
  it("allows reading the board and adding one card", () => {
    expect(isBoardAttachTool("mcp__miro__get_frames")).toBe(true);
    expect(isBoardAttachTool("mcp__miro__list_items")).toBe(true);
    expect(isBoardAttachTool("mcp__miro__create_card_item")).toBe(true);
  });

  it("still refuses anything that changes what is already on the board", () => {
    expect(isBoardAttachTool("mcp__miro__delete_item")).toBe(false);
    expect(isBoardAttachTool("mcp__miro__update_item")).toBe(false);
    expect(isBoardAttachTool("mcp__miro__move_item")).toBe(false);
  });

  it("refuses tools from anywhere but the Miro server", () => {
    expect(isBoardAttachTool("Bash")).toBe(false);
    expect(isBoardAttachTool("mcp__other__create_thing")).toBe(false);
  });
});
