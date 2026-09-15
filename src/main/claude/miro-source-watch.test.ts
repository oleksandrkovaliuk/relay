import { describe, expect, it } from "vitest";

import { boardIdFromUrl, createMiroSourceWatch } from "./miro-source-watch";

const BOARD_URL = "https://miro.com/app/board/uXjVJs049Us=/?share_link_id=815362929307";

const init = (servers: { name: string; status: string }[]) =>
  ({ type: "system", subtype: "init", mcp_servers: servers }) as never;

const toolUse = (id: string, name: string, input: unknown) =>
  ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } }) as never;

const toolResult = (id: string, isError: boolean) =>
  ({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: id, is_error: isError }] },
  }) as never;

const CONNECTED = [{ name: "claude.ai Miro", status: "connected" }];
const onBoard = { miro_url: BOARD_URL };

describe("boardIdFromUrl", () => {
  it("takes the id out of a share link", () => {
    expect(boardIdFromUrl(BOARD_URL)).toBe("uXjVJs049Us=");
    expect(boardIdFromUrl("https://miro.com/app/board/uXjVHyng4sM=/")).toBe("uXjVHyng4sM=");
  });
});

describe("miro source watch", () => {
  it("passes once a read of the board succeeds", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init(CONNECTED));
    watch.observe(toolUse("a", "mcp__claude_ai_Miro__canvas_read_as_svg", onBoard));
    watch.observe(toolResult("a", false));
    expect(watch.failureReason()).toBeNull();
  });

  it("reports a board whose every read was refused", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init(CONNECTED));
    watch.observe(toolUse("a", "mcp__claude_ai_Miro__canvas_search", onBoard));
    watch.observe(toolResult("a", true));
    expect(watch.failureReason()).toMatch(/could not read the Miro board/);
  });

  /** The failure that slipped through: Miro answers, but never about this board. */
  it("does not accept a call that never named the board as proof it was read", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init(CONNECTED));
    watch.observe(toolUse("a", "mcp__claude_ai_Miro__canvas_search", onBoard));
    watch.observe(toolResult("a", true));
    watch.observe(toolUse("b", "mcp__claude_ai_Miro__user_who_am_i", {}));
    watch.observe(toolResult("b", false));
    watch.observe(toolUse("c", "mcp__claude_ai_Miro__space_list", {}));
    watch.observe(toolResult("c", false));
    expect(watch.failureReason()).toMatch(/could not read the Miro board/);
  });

  it("names a missing connection rather than blaming the board", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init([{ name: "claude.ai Slack", status: "connected" }]));
    expect(watch.failureReason()).toMatch(/no Miro connection/);
  });

  it("names an unauthenticated connection", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init([{ name: "miro", status: "needs-auth" }]));
    expect(watch.failureReason()).toMatch(/needs-auth/);
  });

  it("ignores successful tools from other servers", () => {
    const watch = createMiroSourceWatch(BOARD_URL);
    watch.observe(init(CONNECTED));
    watch.observe(toolUse("a", "mcp__claude_ai_Slack__slack_read_channel", onBoard));
    watch.observe(toolResult("a", false));
    expect(watch.failureReason()).toMatch(/could not read the Miro board/);
  });
});
