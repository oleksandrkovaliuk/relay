import type { TeacherDesktopApi } from "@/shared/claude";

/**
 * The teacher UI also runs in a plain browser during development, where the
 * Electron preload bridge is absent. Callers must handle a null bridge rather
 * than crashing the whole workspace.
 */
export function getDesktopBridge(): TeacherDesktopApi | null {
  if (typeof window === "undefined") return null;
  return window.desktop ?? null;
}

export function requireDesktopBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) {
    throw new Error("Claude runs in the desktop app. Open Relay in Electron to generate homework.");
  }
  return bridge;
}
