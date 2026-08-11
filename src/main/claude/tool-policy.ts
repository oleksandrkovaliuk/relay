import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

const MUTATING_TOOL_NAME_PARTS = [
  "add",
  "create",
  "delete",
  "edit",
  "move",
  "publish",
  "resolve",
  "update",
  "write",
] as const;

export function isReadOnlyMiroTool(toolName: string) {
  const normalizedToolName = toolName.toLowerCase();
  if (!normalizedToolName.startsWith("mcp__miro__")) return false;

  return !MUTATING_TOOL_NAME_PARTS.some((part) => normalizedToolName.includes(part));
}

export const allowReadOnlyMiroTools: CanUseTool = async (toolName, input) => {
  if (isReadOnlyMiroTool(toolName)) {
    return {
      behavior: "allow",
      updatedInput: input,
    } satisfies PermissionResult;
  }

  return {
    behavior: "deny",
    message: "This workflow only permits read-only Miro tools.",
  } satisfies PermissionResult;
};

/** Creating an item is the one mutation the attach workflow needs. */
const BOARD_WRITE_TOOL_NAME_PARTS = ["create", "add"] as const;

export function isBoardAttachTool(toolName: string) {
  const normalizedToolName = toolName.toLowerCase();
  if (!normalizedToolName.startsWith("mcp__miro__")) return false;
  if (isReadOnlyMiroTool(toolName)) return true;
  // Anything that deletes, moves or edits existing content stays denied, even
  // though this workflow may write.
  return BOARD_WRITE_TOOL_NAME_PARTS.some((part) => normalizedToolName.includes(part));
}

export const allowBoardAttachTools: CanUseTool = async (toolName, input) => {
  if (isBoardAttachTool(toolName)) {
    return { behavior: "allow", updatedInput: input } satisfies PermissionResult;
  }
  return {
    behavior: "deny",
    message: "This workflow may read the board and add one card, nothing else.",
  } satisfies PermissionResult;
};
