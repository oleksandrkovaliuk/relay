import { describe, expect, it } from "vitest";

import {
  allowBoardAttachTools,
  allowReadOnlyMiroTools,
  isBoardAttachTool,
  isMiroTool,
  isReadOnlyMiroTool,
} from "./tool-policy";

const context = {
  signal: new AbortController().signal,
  toolUseID: "tool-1",
  requestId: "request-1",
};

describe("isMiroTool", () => {
  it("recognises Miro under a declared server and under the teacher's connector", () => {
    expect(isMiroTool("mcp__miro__context_get")).toBe(true);
    expect(isMiroTool("mcp__claude_ai_Miro__context_get")).toBe(true);
  });

  it("refuses tools from anywhere but a Miro server", () => {
    expect(isMiroTool("Bash")).toBe(false);
    expect(isMiroTool("mcp__slack__context_get")).toBe(false);
    expect(isMiroTool("mcp__notmiro__context_get")).toBe(false);
  });
});

describe("read-only Miro policy", () => {
  it("allows the reads a lesson brief needs, whatever the server is called", () => {
    expect(isReadOnlyMiroTool("mcp__miro__canvas_read_as_svg")).toBe(true);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__canvas_search")).toBe(true);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__context_get")).toBe(true);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__board_list_items")).toBe(true);
  });

  /** Each of these writes, and none of them contains a word like "create" or "update". */
  it("denies writes that a name-shaped heuristic used to let through", () => {
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__board_share")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__space_share")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__board_restore")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__comment_reply")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__table_sync_rows")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__record_ui_feedback")).toBe(false);
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__import-claude-design-from-url")).toBe(false);
  });

  it("denies an unfamiliar tool rather than guessing from its name", () => {
    expect(isReadOnlyMiroTool("mcp__claude_ai_Miro__board_teleport")).toBe(false);
  });

  it("returns a deny decision for a write attempt", async () => {
    const result = await allowReadOnlyMiroTools("mcp__claude_ai_Miro__section_delete", {}, context);
    expect(result).toMatchObject({ behavior: "deny" });
  });

  it("returns an allow decision for a read", async () => {
    const result = await allowReadOnlyMiroTools("mcp__claude_ai_Miro__canvas_search", {}, context);
    expect(result).toMatchObject({ behavior: "allow" });
  });
});

describe("isBoardAttachTool", () => {
  it("allows reading the board and creating the one card", () => {
    expect(isBoardAttachTool("mcp__claude_ai_Miro__canvas_search")).toBe(true);
    expect(isBoardAttachTool("mcp__claude_ai_Miro__canvas_read_as_svg")).toBe(true);
    expect(isBoardAttachTool("mcp__claude_ai_Miro__canvas_create_from_svg")).toBe(true);
  });

  it("still refuses anything that changes what is already on the board", () => {
    expect(isBoardAttachTool("mcp__claude_ai_Miro__canvas_update_from_svg")).toBe(false);
    expect(isBoardAttachTool("mcp__claude_ai_Miro__section_delete")).toBe(false);
    expect(isBoardAttachTool("mcp__claude_ai_Miro__board_move")).toBe(false);
    expect(isBoardAttachTool("mcp__claude_ai_Miro__board_share")).toBe(false);
  });

  it("refuses tools from anywhere but a Miro server", async () => {
    expect(isBoardAttachTool("Bash")).toBe(false);
    expect(isBoardAttachTool("mcp__other__canvas_create_from_svg")).toBe(false);
    const result = await allowBoardAttachTools("Bash", {}, context);
    expect(result).toMatchObject({ behavior: "deny" });
  });
});
