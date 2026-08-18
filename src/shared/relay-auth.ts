import { z } from "zod";

export const relayAuthUrlSchema = z.string().url();

export const RELAY_AUTH_IPC_CHANNELS = {
  getRedirectUrl: "relay-auth:get-redirect-url",
  openAuthorization: "relay-auth:open-authorization",
} as const;

export interface RelayAuthDesktopApi {
  getRelayAuthRedirectUrl(): Promise<string>;
  openRelayAuthAuthorization(authorizationUrl: string): Promise<string>;
}
