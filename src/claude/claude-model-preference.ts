import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, type ClaudeModel } from "@/shared/claude";

const STORAGE_KEY = "relay:claude-model:v1";

/**
 * Which model every Claude request runs on. Stored on this Mac beside the theme
 * rather than in the workspace: it is a taste-and-patience choice about the
 * machine you generate on, not a property of the homework.
 */
export function readClaudeModel(): ClaudeModel {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const known = CLAUDE_MODELS.find((model) => model.id === stored);
    return known?.id ?? DEFAULT_CLAUDE_MODEL;
  } catch {
    return DEFAULT_CLAUDE_MODEL;
  }
}

export function writeClaudeModel(model: ClaudeModel) {
  try {
    window.localStorage.setItem(STORAGE_KEY, model);
  } catch {
    // Generation still works; the choice just will not survive a restart.
  }
}
