import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClerkBridge } from "@clerk/electron";
import { app, BrowserWindow, nativeImage, net, protocol, session, shell } from "electron";

import { ClaudeConnectionStore } from "./claude/claude-connections";
import { ClaudeService } from "./claude/claude-service";
import { registerClaudeConnectionIpc } from "./claude/register-claude-connection-ipc";
import { registerClaudeIpc } from "./claude/register-claude-ipc";
import { resolveClaudeExecutable } from "./claude/resolve-claude-executable";
import { resolveClerkFrontendApiHost } from "./clerk-frontend-api";
import { createFileTokenStorage } from "./clerk-token-storage";
import { createExternalNavigationGuard } from "./external-navigation";
import {
  withRendererCorsForNativeClerkResponse,
  withoutBrowserOriginForNativeClerkRequest,
} from "./clerk-native-request";
import { registerNotificationIpc } from "./notifications/register-notification-ipc";
import {
  RENDERER_HOST,
  RENDERER_ORIGIN,
  RENDERER_SCHEME,
  RENDERER_URL,
  resolveRendererDevelopmentUrl,
  resolveRendererFilePath,
  shouldOpenInExternalBrowser,
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
  // Relay's window only ever shows its own renderer; everything else belongs in the
  // user's browser, where their sessions and password manager live.
  const externalNavigation = createExternalNavigationGuard({ now: () => Date.now() });
  const openExternally = (url: string) => {
    if (!externalNavigation.shouldOpen(url)) {
      console.warn(`Ignored a repeated request to open ${url} externally.`);
      return;
    }
    void shell.openExternal(url);
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenInExternalBrowser(url)) openExternally(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!shouldOpenInExternalBrowser(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  void mainWindow.loadURL(RENDERER_URL);
  return mainWindow;
}

function registerRendererProtocol() {
  protocol.handle(RENDERER_SCHEME, (request) => {
    const developmentServerUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
    if (developmentServerUrl) {
      const developmentUrl = resolveRendererDevelopmentUrl(request.url, developmentServerUrl);
      if (!developmentUrl) return new Response(null, { status: 404 });
      // Forward the method and body too, so anything Vite serves over POST still works
      // through the proxy rather than silently arriving as a GET.
      const init: RequestInit = { method: request.method };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        Reflect.set(init, "duplex", "half");
      }
      return net.fetch(developmentUrl, init);
    }

    const rendererDirectory = join(__dirname, "../renderer");
    const rendererFilePath = resolveRendererFilePath(request.url, rendererDirectory);
    if (!rendererFilePath) return new Response(null, { status: 404 });
    const rendererFileUrl = pathToFileURL(rendererFilePath);
    return net.fetch(rendererFileUrl.toString());
  });
}

/**
 * Clerk's Electron transport is a native API client living inside a Chromium page, so
 * two browser behaviours have to be reconciled with it — and only for its own calls to
 * its own instance, which is why the filter is scoped to the resolved Frontend API host.
 */
function registerClerkNativeTransport(frontendApiHost: string) {
  const filter = { urls: [`https://${frontendApiHost}/*`] };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: withoutBrowserOriginForNativeClerkRequest(
        details.url,
        details.requestHeaders,
        frontendApiHost,
      ),
    });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    callback({
      responseHeaders: withRendererCorsForNativeClerkResponse(
        details.url,
        details.responseHeaders ?? {},
        RENDERER_ORIGIN,
        frontendApiHost,
      ),
    });
  });
}

const DEVELOPMENT_INSPECT_PORT = "9222";
const LEGACY_USER_DATA_PATH = app.getPath("userData");
/**
 * Resolved from the same publishable key the renderer uses, so a development run talks
 * to the development instance and a packaged build to the production one. The renderer
 * refuses to start without this key, so a missing host means the app cannot sign in
 * either way — log it and leave the interceptors unregistered rather than guessing a host.
 */
const CLERK_FRONTEND_API_HOST = resolveClerkFrontendApiHost(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// Brand the native menus without moving the local profiles created by earlier ERM builds.
app.setName("Relay");
// The dock and the About panel read these; without them a development run
// inherits Electron's own bundle name.
app.setAboutPanelOptions({ applicationName: "Relay", applicationVersion: app.getVersion() });
app.setPath("userData", LEGACY_USER_DATA_PATH);

const clerkBridge = createClerkBridge({
  renderer: { scheme: RENDERER_SCHEME, host: RENDERER_HOST },
  storage: createFileTokenStorage(join(app.getPath("userData"), "clerk-tokens.json")),
  userAgent: `Relay/${app.getVersion()}`,
});
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", DEVELOPMENT_INSPECT_PORT);
  // Clerk's bridge registers the scheme, but an unpackaged run is launched through the
  // Electron binary, so the OS needs the script path as well to route an OAuth callback
  // back to this instance rather than to Electron itself.
  const [, entryScript] = process.argv;
  if (process.defaultApp && entryScript) {
    app.setAsDefaultProtocolClient(RENDERER_SCHEME, process.execPath, [resolve(entryScript)]);
  }
}

if (clerkBridge.isPrimaryInstance) {
  startPrimaryInstance();
}

function startPrimaryInstance() {
  app.whenReady().then(() => {
    // Keep the legacy identifier so existing Windows notification permissions remain valid.
    app.setAppUserModelId("com.erm.teacher");
    registerRendererProtocol();
    if (CLERK_FRONTEND_API_HOST) registerClerkNativeTransport(CLERK_FRONTEND_API_HOST);
    else console.error("Could not resolve Clerk's Frontend API host from the publishable key.");
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
