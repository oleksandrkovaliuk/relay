import { join } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { ClaudeService } from "./claude/claude-service";
import { registerClaudeIpc } from "./claude/register-claude-ipc";
import { registerNotificationIpc } from "./notifications/register-notification-ipc";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Failed to load preload script at ${preloadPath}:`, error);
  });
  mainWindow.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) console.error(`Renderer: ${message}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

const DEVELOPMENT_INSPECT_PORT = "9222";

if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", DEVELOPMENT_INSPECT_PORT);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.erm.teacher");
  const claudeService = new ClaudeService({
    workingDirectory: join(app.getPath("userData"), "ai-workspace"),
    openExternal: (url) => shell.openExternal(url),
  });
  registerClaudeIpc(claudeService);
  registerNotificationIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
