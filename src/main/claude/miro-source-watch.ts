import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import { isMiroServer, isMiroTool } from "./tool-policy";

/**
 * Watches a board-sourced run for the one outcome the teacher must never be handed
 * silently: homework written without the board it was supposed to be built from.
 *
 * The model treats an unreadable board as missing context and writes from the notes
 * instead, so the run succeeds and the draft looks ordinary. Nothing downstream can tell
 * the difference, which is how a prefix mismatch in the tool policy went unnoticed while
 * every teacher who picked a board got homework unrelated to their lesson.
 */
/**
 * The board's own id, which every call that touches it carries in its arguments.
 * `https://miro.com/app/board/uXjVJs049Us=/?share_link_id=…` identifies board `uXjVJs049Us=`.
 */
export function boardIdFromUrl(boardUrl: string) {
  return boardUrl.split("/board/")[1]?.split(/[/?#]/)[0] ?? null;
}

export function createMiroSourceWatch(boardUrl: string) {
  const boardId = boardIdFromUrl(boardUrl);
  let miroServerStatus: string | null = null;
  let readSucceeded = false;
  /**
   * Only calls naming this board count. A run against an unreadable board still makes
   * Miro calls that succeed — `user_who_am_i`, `space_list`, a board search — and
   * treating any of those as proof let a draft written from nothing pass as a board read.
   */
  const pendingToolIds = new Set<string>();

  return {
    observe(message: SDKMessage) {
      const untyped = message as Record<string, any>;

      if (untyped.type === "system" && untyped.subtype === "init") {
        const servers: { name?: string; status?: string }[] = untyped.mcp_servers ?? [];
        const miro = servers.find((server) => isMiroServer(server.name ?? ""));
        miroServerStatus = miro?.status ?? null;
      }

      if (untyped.type === "assistant") {
        for (const block of untyped.message?.content ?? []) {
          if (block.type !== "tool_use" || !isMiroTool(block.name)) continue;
          const mentionsBoard =
            boardId !== null && JSON.stringify(block.input ?? {}).includes(boardId);
          if (mentionsBoard) pendingToolIds.add(block.id);
        }
      }

      if (untyped.type === "user") {
        for (const block of untyped.message?.content ?? []) {
          if (block.type !== "tool_result") continue;
          if (!pendingToolIds.delete(block.tool_use_id)) continue;
          if (!block.is_error) readSucceeded = true;
        }
      }
    },

    /** The reason the board never arrived, or null when it did. */
    failureReason(): string | null {
      if (readSucceeded) return null;
      if (miroServerStatus === null) {
        return "Claude has no Miro connection, so the board could not be read. Connect Miro to the Claude account Relay runs as, then try again.";
      }
      if (miroServerStatus !== "connected") {
        return `Claude's Miro connection is not ready (${miroServerStatus}), so the board could not be read. Reconnect Miro to the Claude account Relay runs as, then try again.`;
      }
      return "Claude could not read the Miro board. Check that the board is shared with the Miro account connected to Claude, then try again.";
    },
  };
}
