import { ipcMain, type WebContents } from "electron";

import {
  cancelClaudeRequestSchema,
  CLAUDE_IPC_CHANNELS,
  generateHomeworkInputSchema,
  summarizeSubmissionInputSchema,
  type ClaudeRuntimeEvent,
} from "@/shared/claude";
import type { ClaudeService } from "./claude-service";

function sendRuntimeEvent(webContents: WebContents, event: ClaudeRuntimeEvent) {
  if (webContents.isDestroyed()) return;
  webContents.send(CLAUDE_IPC_CHANNELS.runtimeEvent, event);
}

export function registerClaudeIpc(claudeService: ClaudeService) {
  ipcMain.handle(CLAUDE_IPC_CHANNELS.checkAvailability, () => claudeService.checkAvailability());

  ipcMain.handle(CLAUDE_IPC_CHANNELS.generateHomework, (event, unsafeInput: unknown) => {
    const input = generateHomeworkInputSchema.parse(unsafeInput);
    return claudeService.generateHomework(input, (runtimeEvent) =>
      sendRuntimeEvent(event.sender, runtimeEvent),
    );
  });

  ipcMain.handle(CLAUDE_IPC_CHANNELS.summarizeSubmission, (event, unsafeInput: unknown) => {
    const input = summarizeSubmissionInputSchema.parse(unsafeInput);
    return claudeService.summarizeSubmission(input, (runtimeEvent) =>
      sendRuntimeEvent(event.sender, runtimeEvent),
    );
  });

  ipcMain.handle(CLAUDE_IPC_CHANNELS.cancelRequest, (_, unsafeInput: unknown) => {
    const input = cancelClaudeRequestSchema.parse(unsafeInput);
    return claudeService.cancelRequest(input.requestId);
  });
}
