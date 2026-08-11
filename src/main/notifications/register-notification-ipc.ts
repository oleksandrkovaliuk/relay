import { BrowserWindow, Notification, ipcMain } from "electron";

import { DESKTOP_IPC_CHANNELS, desktopNotificationSchema } from "@/shared/claude";

/**
 * Homework generation regularly outlives the teacher's attention, so finishing
 * is worth an OS notification — but only when they have looked away. Notifying
 * someone about something already on their screen is just noise.
 */
export function registerNotificationIpc() {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.notify, (_event, unsafeInput: unknown) => {
    const { title, body } = desktopNotificationSchema.parse(unsafeInput);
    if (!Notification.isSupported()) return false;

    const windows = BrowserWindow.getAllWindows();
    if (windows.some((window) => window.isFocused())) return false;

    const notification = new Notification({ title, body });
    notification.on("click", () => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) return;
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    });
    notification.show();
    return true;
  });
}
