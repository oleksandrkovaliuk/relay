import { contextBridge, ipcRenderer } from "electron";

import {
  claudeAvailabilitySchema,
  claudeGenerationResultSchema,
  claudeRuntimeEventSchema,
  claudeSummaryResultSchema,
  CLAUDE_IPC_CHANNELS,
  DESKTOP_IPC_CHANNELS,
  desktopNotificationSchema,
  generateHomeworkInputSchema,
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
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
