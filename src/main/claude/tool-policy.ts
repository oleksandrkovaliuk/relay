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
