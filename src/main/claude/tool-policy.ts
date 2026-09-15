import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

/**
 * Miro reaches the subprocess under whatever name its MCP server is registered with —
 * `mcp__miro__…` for a server Relay declares itself, `mcp__claude_ai_Miro__…` for the
 * teacher's own claude.ai connector — so the server segment is matched rather than a
 * fixed prefix. Matching the prefix alone denied every tool the connector offered, and
 * the generation then produced homework that ignored the board without saying so.
 */
export function isMiroServer(serverName: string) {
  // Tool names carry `claude_ai_Miro`; the runtime's server list calls the same
  // connector `claude.ai Miro`, so both are reduced to their last word.
  return serverName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).at(-1) === "miro";
}

export function isMiroTool(toolName: string) {
  const [namespace, server] = toolName.toLowerCase().split("__");
  if (namespace !== "mcp" || !server) return false;
  return isMiroServer(server);
}

/** The tool name with its `mcp__<server>__` prefix removed. */
function miroToolAction(toolName: string) {
  return toolName.toLowerCase().split("__").slice(2).join("__");
}

/**
 * Named one by one, because inferring intent from the name does not survive contact with
 * Miro's vocabulary: `board_share`, `board_restore`, `comment_reply`, `table_sync_rows`
 * and `import-claude-design-from-url` all write, and none of them contains a word like
 * "create" or "update". An unknown tool is denied — a read Relay has not seen before is
 * a missing entry here, which surfaces as a failed generation rather than as a board
 * quietly modified.
 */
const READ_ONLY_MIRO_ACTIONS = new Set([
  "board_get_space",
  "board_list_items",
  "board_search_boards",
  "board_show",
  "canvas_get_canvas_composer_skill",
  "canvas_load_format_skill",
  "canvas_read_as_svg",
  "canvas_search",
  "comment_list_comments",
  "content_item_list_roles",
  "context_explore",
  "context_get",
  "diagram_get_mermaid_instructions",
  "doc_get",
  "image_get_data",
  "image_get_url",
  "layout_get_dsl",
  "layout_read",
  "preview_resource_poll",
  "prototype_read",
  "space_list",
  "space_list_boards",
  "space_list_children",
  "table_get_latest_update_history",
  "table_list_rows",
  "user_who_am_i",
]);

/**
 * Creating content is the one mutation the attach workflow needs. Miro routes every
 * creation through the canvas composer, so this is one tool rather than a card-shaped one.
 */
const BOARD_WRITE_ACTIONS = new Set(["canvas_create_from_svg"]);

export function isReadOnlyMiroTool(toolName: string) {
  if (!isMiroTool(toolName)) return false;
  return READ_ONLY_MIRO_ACTIONS.has(miroToolAction(toolName));
}

export function isBoardAttachTool(toolName: string) {
  if (!isMiroTool(toolName)) return false;
  const action = miroToolAction(toolName);
  return READ_ONLY_MIRO_ACTIONS.has(action) || BOARD_WRITE_ACTIONS.has(action);
}

export const allowReadOnlyMiroTools: CanUseTool = async (toolName, input) => {
  if (isReadOnlyMiroTool(toolName)) {
    return { behavior: "allow", updatedInput: input } satisfies PermissionResult;
  }

  return {
    behavior: "deny",
    message: "This workflow only permits read-only Miro tools.",
  } satisfies PermissionResult;
};

export const allowBoardAttachTools: CanUseTool = async (toolName, input) => {
  if (isBoardAttachTool(toolName)) {
    return { behavior: "allow", updatedInput: input } satisfies PermissionResult;
  }
  return {
    behavior: "deny",
    message: "This workflow may read the board and add one card, nothing else.",
  } satisfies PermissionResult;
};
