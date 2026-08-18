import { exposeClerkBridge } from "@clerk/electron/preload";
import { contextBridge, ipcRenderer } from "electron";

import {
  addClaudeConnectionSchema,
  attachHomeworkToBoardInputSchema,
  claudeBoardAttachmentResultSchema,
  claudeAvailabilitySchema,
  claudeConnectionRefSchema,
  claudeConnectionStateSchema,
  claudeLoginEventSchema,
  CLAUDE_CONNECTION_IPC_CHANNELS,
  claudeGenerationResultSchema,
  claudeRuntimeEventSchema,
  claudeQuestionRewriteResultSchema,
  claudeSummaryResultSchema,
  CLAUDE_IPC_CHANNELS,
  DESKTOP_IPC_CHANNELS,
  desktopNotificationSchema,
  generateHomeworkInputSchema,
  rewriteHomeworkQuestionInputSchema,
  startClaudeLoginSchema,
  submitClaudeLoginCodeSchema,
  summarizeSubmissionInputSchema,
  type TeacherDesktopApi,
} from "@/shared/claude";

const desktopApi: TeacherDesktopApi = {
  platform: process.platform,
  async checkClaudeAvailability() {
    const result: unknown = await ipcRenderer.invoke(CLAUDE_IPC_CHANNELS.checkAvailability);
    return claudeAvailabilitySchema.parse(result);
  },
  async generateHomework(unsafeInput) {
    const input = generateHomeworkInputSchema.parse(unsafeInput);
    const result: unknown = await ipcRenderer.invoke(CLAUDE_IPC_CHANNELS.generateHomework, input);
    return claudeGenerationResultSchema.parse(result);
  },
  async rewriteHomeworkQuestion(unsafeInput) {
    const input = rewriteHomeworkQuestionInputSchema.parse(unsafeInput);
    const result: unknown = await ipcRenderer.invoke(
      CLAUDE_IPC_CHANNELS.rewriteHomeworkQuestion,
      input,
    );
    return claudeQuestionRewriteResultSchema.parse(result);
  },
  async summarizeSubmission(unsafeInput) {
    const input = summarizeSubmissionInputSchema.parse(unsafeInput);
    const result: unknown = await ipcRenderer.invoke(
      CLAUDE_IPC_CHANNELS.summarizeSubmission,
      input,
    );
    return claudeSummaryResultSchema.parse(result);
  },
  async cancelClaudeRequest(requestId) {
    const result: unknown = await ipcRenderer.invoke(CLAUDE_IPC_CHANNELS.cancelRequest, {
      requestId,
    });
    return result === true;
  },
  onClaudeRuntimeEvent(listener) {
    const handler = (_event: Electron.IpcRendererEvent, unsafeEvent: unknown) => {
      listener(claudeRuntimeEventSchema.parse(unsafeEvent));
    };
    ipcRenderer.on(CLAUDE_IPC_CHANNELS.runtimeEvent, handler);
    return () => ipcRenderer.removeListener(CLAUDE_IPC_CHANNELS.runtimeEvent, handler);
  },
  async notify(unsafeNotification) {
    const notification = desktopNotificationSchema.parse(unsafeNotification);
    const result: unknown = await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.notify, notification);
    return result === true;
  },
  async listClaudeConnections() {
    const result: unknown = await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.list);
    return claudeConnectionStateSchema.parse(result);
  },
  async addClaudeConnection(label) {
    const input = addClaudeConnectionSchema.parse({ label });
    const result: unknown = await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.add, input);
    return claudeConnectionStateSchema.parse(result);
  },
  async activateClaudeConnection(id) {
    const input = claudeConnectionRefSchema.parse({ id });
    const result: unknown = await ipcRenderer.invoke(
      CLAUDE_CONNECTION_IPC_CHANNELS.activate,
      input,
    );
    return claudeConnectionStateSchema.parse(result);
  },
  async removeClaudeConnection(id) {
    const input = claudeConnectionRefSchema.parse({ id });
    const result: unknown = await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.remove, input);
    return claudeConnectionStateSchema.parse(result);
  },
  async claudeLoginCommand(id) {
    const input = claudeConnectionRefSchema.parse({ id });
    const result: unknown = await ipcRenderer.invoke(
      CLAUDE_CONNECTION_IPC_CHANNELS.loginCommand,
      input,
    );
    return String(result);
  },
  async startClaudeLogin(unsafeInput) {
    const input = startClaudeLoginSchema.parse(unsafeInput);
    await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.startLogin, input);
  },
  async submitClaudeLoginCode(code) {
    const input = submitClaudeLoginCodeSchema.parse({ code });
    await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.submitLoginCode, input);
  },
  async cancelClaudeLogin() {
    await ipcRenderer.invoke(CLAUDE_CONNECTION_IPC_CHANNELS.cancelLogin);
  },
  onClaudeLoginEvent(listener) {
    const handler = (_event: Electron.IpcRendererEvent, unsafeEvent: unknown) => {
      listener(claudeLoginEventSchema.parse(unsafeEvent));
    };
    ipcRenderer.on(CLAUDE_CONNECTION_IPC_CHANNELS.loginEvent, handler);
    return () => ipcRenderer.removeListener(CLAUDE_CONNECTION_IPC_CHANNELS.loginEvent, handler);
  },
  async attachHomeworkToBoard(unsafeInput) {
    const input = attachHomeworkToBoardInputSchema.parse(unsafeInput);
    const result: unknown = await ipcRenderer.invoke(
      CLAUDE_IPC_CHANNELS.attachHomeworkToBoard,
      input,
    );
    return claudeBoardAttachmentResultSchema.parse(result);
  },
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
exposeClerkBridge();
