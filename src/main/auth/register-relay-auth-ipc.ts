import { ipcMain } from "electron";

import { RELAY_AUTH_IPC_CHANNELS, relayAuthUrlSchema } from "@/shared/relay-auth";
import type { RelayAuthService } from "./relay-auth-service";

export function registerRelayAuthIpc(service: RelayAuthService) {
  ipcMain.handle(RELAY_AUTH_IPC_CHANNELS.getRedirectUrl, () => service.getRedirectUrl());
  ipcMain.handle(RELAY_AUTH_IPC_CHANNELS.openAuthorization, (_event, unsafeUrl: unknown) => {
    const authorizationUrl = relayAuthUrlSchema.parse(unsafeUrl);
    return service.openAuthorization(authorizationUrl);
  });
}
