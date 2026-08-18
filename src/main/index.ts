import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createClerkBridge } from "@clerk/electron";
import { storage as createClerkStorage } from "@clerk/electron/storage";
import { app, BrowserWindow, nativeImage, net, protocol, shell } from "electron";

import { ClaudeConnectionStore } from "./claude/claude-connections";
import { ClaudeService } from "./claude/claude-service";
import { registerClaudeConnectionIpc } from "./claude/register-claude-connection-ipc";
import { registerClaudeIpc } from "./claude/register-claude-ipc";
import { resolveClaudeExecutable } from "./claude/resolve-claude-executable";
import { registerNotificationIpc } from "./notifications/register-notification-ipc";
import {
  RENDERER_HOST,
  RENDERER_SCHEME,
  RENDERER_URL,
  resolveRendererFilePath,
} from "./renderer-protocol";

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
  mainWindow.webContents.on("console-message", (details) => {
    if (details.level === "warning" || details.level === "error") {
      console.error(`Renderer: ${details.message}`);
    }
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
  });
  mainWindow.on("ready-to-show", () => {
    // electron-vite relaunches the app on every main or preload rebuild, and a
    // window that shows itself takes focus with it — so a save in the editor
    // yanked the app in front of whatever you were doing. In development the
    // window appears without stealing focus; a real launch still comes forward.
    if (app.isPackaged) mainWindow.show();
    else mainWindow.showInactive();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadURL(RENDERER_URL);
}

function registerRendererProtocol() {
  protocol.handle(RENDERER_SCHEME, (request) => {
    const rendererDirectory = join(__dirname, "../renderer");
    const rendererFilePath = resolveRendererFilePath(request.url, rendererDirectory);
    if (!rendererFilePath) return new Response(null, { status: 404 });
    const rendererFileUrl = pathToFileURL(rendererFilePath);
    return net.fetch(rendererFileUrl.toString());
  });
}

const DEVELOPMENT_INSPECT_PORT = "9222";
const LEGACY_USER_DATA_PATH = app.getPath("userData");

// Brand the native menus without moving the local profiles created by earlier ERM builds.
app.setName("Relay");
// The dock and the About panel read these; without them a development run
// inherits Electron's own bundle name.
app.setAboutPanelOptions({ applicationName: "Relay", applicationVersion: app.getVersion() });
app.setPath("userData", LEGACY_USER_DATA_PATH);

const clerkBridge = createClerkBridge({
  renderer: { scheme: RENDERER_SCHEME, host: RENDERER_HOST },
  storage: createClerkStorage({ path: app.getPath("userData") }),
  userAgent: `Relay/${app.getVersion()}`,
});

if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", DEVELOPMENT_INSPECT_PORT);
}

if (clerkBridge.isPrimaryInstance) {
  startPrimaryInstance();
}

function startPrimaryInstance() {
  app.whenReady().then(() => {
    // Keep the legacy identifier so existing Windows notification permissions remain valid.
    app.setAppUserModelId("com.erm.teacher");
    registerRendererProtocol();
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

    // A quit must take the Claude child processes with it, or they keep running —
    // and keep their memory — with nothing left to receive the answer.
    app.on("before-quit", () => {
      clerkBridge.cleanup();
      void claudeService.cancelAllRequests().catch(() => undefined);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
