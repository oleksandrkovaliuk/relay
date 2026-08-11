import { existsSync } from "node:fs";
import { join } from "node:path";

import { app, BrowserWindow, nativeImage, shell } from "electron";

import { ClaudeConnectionStore } from "./claude/claude-connections";
import { ClaudeService } from "./claude/claude-service";
import { registerClaudeConnectionIpc } from "./claude/register-claude-connection-ipc";
import { registerClaudeIpc } from "./claude/register-claude-ipc";
import { resolveClaudeExecutable } from "./claude/resolve-claude-executable";
import { registerNotificationIpc } from "./notifications/register-notification-ipc";

/**
 * Packaged, `resources/` is copied beside the asar archive rather than into it, so
 * the path differs from development. Reading it from inside the archive silently
 * failed and left Electron's own icon in place.
 */
const APP_ICON_PATH = app.isPackaged
  ? join(process.resourcesPath, "resources", "relay-app-icon-512.png")
  : join(__dirname, "../../resources/relay-app-icon-512.png");

function loadAppIcon() {
  if (!existsSync(APP_ICON_PATH)) return null;
  const icon = nativeImage.createFromPath(APP_ICON_PATH);
  return icon.isEmpty() ? null : icon;
}

function createWindow() {
  const appIcon = loadAppIcon();
  const mainWindow = new BrowserWindow({
    title: "Relay",
    ...(appIcon ? { icon: appIcon } : {}),
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
const LEGACY_USER_DATA_PATH = app.getPath("userData");

// Brand the native menus without moving the local profiles created by earlier ERM builds.
app.setName("Relay");
// The dock and the About panel read these; without them a development run
// inherits Electron's own bundle name.
app.setAboutPanelOptions({ applicationName: "Relay", applicationVersion: app.getVersion() });
app.setPath("userData", LEGACY_USER_DATA_PATH);

if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", DEVELOPMENT_INSPECT_PORT);
}

app.whenReady().then(() => {
  // Keep the legacy identifier so existing Windows notification permissions remain valid.
  app.setAppUserModelId("com.erm.teacher");
  // In development the dock shows Electron's own icon unless it is replaced.
  const dockIcon = loadAppIcon();
  if (dockIcon && process.platform === "darwin") app.dock?.setIcon(dockIcon);
  const connections = new ClaudeConnectionStore({
    stateFilePath: join(app.getPath("userData"), "claude-connections.json"),
    configRootPath: join(app.getPath("userData"), "claude-configs"),
  });
  const claudeService = new ClaudeService({
    workingDirectory: join(app.getPath("userData"), "ai-workspace"),
    openExternal: (url) => shell.openExternal(url),
    resolveConfigDir: () => connections.activeConfigDir(),
  });
  registerClaudeIpc(claudeService);
  registerClaudeConnectionIpc({
    connections,
    resolveExecutablePath: () => resolveClaudeExecutable({ environment: process.env }),
    environment: process.env,
  });
  registerNotificationIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
