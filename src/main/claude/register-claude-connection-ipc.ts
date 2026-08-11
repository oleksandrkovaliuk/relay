import { ipcMain, type WebContents } from "electron";

import {
  addClaudeConnectionSchema,
  claudeConnectionRefSchema,
  CLAUDE_CONNECTION_IPC_CHANNELS,
  startClaudeLoginSchema,
  submitClaudeLoginCodeSchema,
  type ClaudeConnectionState,
  type ClaudeLoginEvent,
  type StoredClaudeConnectionState,
} from "@/shared/claude";
import { readClaudeAccount } from "./claude-account-status";
import type { ClaudeConnectionStore } from "./claude-connections";
import { ClaudeLoginSession } from "./claude-login-session";

export function registerClaudeConnectionIpc({
  connections,
  resolveExecutablePath,
  environment,
}: {
  connections: ClaudeConnectionStore;
  resolveExecutablePath: () => string | null;
  environment: NodeJS.ProcessEnv;
}) {
  let loginSession: ClaudeLoginSession | null = null;

  /**
   * Asks the CLI who is signed in to each config directory, so the settings page
   * can show real email addresses rather than opaque labels.
   */
  async function describe(state: StoredClaudeConnectionState): Promise<ClaudeConnectionState> {
    const executablePath = resolveExecutablePath();
    return {
      connections: await Promise.all(
        state.connections.map(async (connection) => ({
          ...connection,
          account: await readClaudeAccount({
            executablePath,
            environment,
            configDir: connection.configDir,
          }),
        })),
      ),
    };
  }

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.list, () => describe(connections.list()));

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.add, (_event, unsafeInput: unknown) => {
    const { label } = addClaudeConnectionSchema.parse(unsafeInput);
    return describe(connections.add(label));
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.activate, (_event, unsafeInput: unknown) => {
    const { id } = claudeConnectionRefSchema.parse(unsafeInput);
    return describe(connections.activate(id));
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.remove, (_event, unsafeInput: unknown) => {
    const { id } = claudeConnectionRefSchema.parse(unsafeInput);
    return describe(connections.remove(id));
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.loginCommand, (_event, unsafeInput: unknown) => {
    const { id } = claudeConnectionRefSchema.parse(unsafeInput);
    return connections.loginCommand(id);
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.startLogin, (event, unsafeInput: unknown) => {
    const { id, email } = startClaudeLoginSchema.parse(unsafeInput);
    const connection = connections.find(id);

    loginSession?.cancel();
    loginSession = new ClaudeLoginSession((loginEvent) =>
      sendLoginEvent(event.sender, loginEvent),
    );
    loginSession.start({
      executablePath: resolveExecutablePath(),
      environment,
      configDir: connection.configDir,
      ...(email ? { email } : {}),
    });
    return null;
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.submitLoginCode, (_event, unsafeInput: unknown) => {
    const { code } = submitClaudeLoginCodeSchema.parse(unsafeInput);
    if (!loginSession) throw new Error("There is no sign-in in progress.");
    loginSession.submitCode(code);
    return null;
  });

  ipcMain.handle(CLAUDE_CONNECTION_IPC_CHANNELS.cancelLogin, () => {
    loginSession?.cancel();
    loginSession = null;
    return null;
  });
}

function sendLoginEvent(webContents: WebContents, event: ClaudeLoginEvent) {
  if (webContents.isDestroyed()) return;
  webContents.send(CLAUDE_CONNECTION_IPC_CHANNELS.loginEvent, event);
}
