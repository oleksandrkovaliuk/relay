import { createServer, type Server } from "node:http";

import { shell } from "electron";

import {
  renderFailedRelayAuthPage,
  renderSuccessfulRelayAuthPage,
} from "./relay-auth-callback-page";
import { CALLBACK_HOST, CALLBACK_PORT, REDIRECT_URI } from "./relay-auth-config";

const CALLBACK_TIMEOUT_MILLISECONDS = 5 * 60_000;

type PendingCallback = {
  reject: (error: Error) => void;
  resolve: (callbackUrl: string) => void;
};

/**
 * Adapts Clerk's normal browser-based social sign-in to Electron. Clerk owns
 * the session and token exchange; the main process only opens the system
 * browser and returns the loopback callback URL to Clerk's renderer SDK.
 */
export class RelayAuthService {
  private readonly onSignInCompleted: () => void;
  private callbackServer: Server | null = null;
  private callbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingCallback: PendingCallback | null = null;

  constructor({ onSignInCompleted }: { onSignInCompleted: () => void }) {
    this.onSignInCompleted = onSignInCompleted;
  }

  getRedirectUrl() {
    return REDIRECT_URI;
  }

  async openAuthorization(authorizationUrl: string) {
    if (this.pendingCallback) {
      throw new Error("A Relay sign-in is already in progress.");
    }

    const callback = new Promise<string>((resolve, reject) => {
      this.pendingCallback = { resolve, reject };
    });

    try {
      await this.startCallbackServer();
      await shell.openExternal(authorizationUrl);
      return await callback;
    } catch (error) {
      this.rejectPendingCallback(describeError(error));
      throw error;
    }
  }

  private async startCallbackServer() {
    const server = createServer((request, response) => {
      const callbackUrl = new URL(request.url ?? "/", REDIRECT_URI);
      if (callbackUrl.pathname !== "/oauth/callback") {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        callbackUrl.searchParams.has("error")
          ? renderFailedRelayAuthPage()
          : renderSuccessfulRelayAuthPage(),
      );
      this.resolvePendingCallback(callbackUrl.toString());
      this.onSignInCompleted();
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
        server.off("error", reject);
        resolve();
      });
    });

    this.callbackServer = server;
    this.callbackTimeout = setTimeout(() => {
      this.rejectPendingCallback("Google sign-in timed out. Please try again.");
    }, CALLBACK_TIMEOUT_MILLISECONDS);
    this.callbackTimeout.unref();
  }

  private resolvePendingCallback(callbackUrl: string) {
    const pending = this.pendingCallback;
    this.stopCallbackServer();
    pending?.resolve(callbackUrl);
  }

  private rejectPendingCallback(message: string) {
    const pending = this.pendingCallback;
    this.stopCallbackServer();
    pending?.reject(new Error(message));
  }

  private stopCallbackServer() {
    if (this.callbackTimeout) clearTimeout(this.callbackTimeout);
    this.callbackTimeout = null;
    this.callbackServer?.close();
    this.callbackServer = null;
    this.pendingCallback = null;
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Relay sign-in failed.";
}
