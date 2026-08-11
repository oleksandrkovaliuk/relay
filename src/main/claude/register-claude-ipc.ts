import { ipcMain, type WebContents } from "electron";

import {
  attachHomeworkToBoardInputSchema,
  cancelClaudeRequestSchema,
  CLAUDE_IPC_CHANNELS,
  generateHomeworkInputSchema,
  rewriteHomeworkQuestionInputSchema,
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

  ipcMain.handle(CLAUDE_IPC_CHANNELS.rewriteHomeworkQuestion, (event, unsafeInput: unknown) => {
    const input = rewriteHomeworkQuestionInputSchema.parse(unsafeInput);
    return claudeService.rewriteHomeworkQuestion(input, (runtimeEvent) =>
      sendRuntimeEvent(event.sender, runtimeEvent),
    );
  });

  ipcMain.handle(CLAUDE_IPC_CHANNELS.summarizeSubmission, (event, unsafeInput: unknown) => {
    const input = summarizeSubmissionInputSchema.parse(unsafeInput);
    return claudeService.summarizeSubmission(input, (runtimeEvent) =>
      sendRuntimeEvent(event.sender, runtimeEvent),
    );
  });

  ipcMain.handle(
    CLAUDE_IPC_CHANNELS.attachHomeworkToBoard,
    async (event, payload: unknown) =>
      claudeService.attachHomeworkToBoard(
        attachHomeworkToBoardInputSchema.parse(payload),
        (runtimeEvent) => sendRuntimeEvent(event.sender, runtimeEvent),
      ),
  );

  ipcMain.handle(CLAUDE_IPC_CHANNELS.cancelRequest, (_, unsafeInput: unknown) => {
    const input = cancelClaudeRequestSchema.parse(unsafeInput);
    return claudeService.cancelRequest(input.requestId);
  });
}
