/**
 * Clerk's Electron OAuth transport sends the browser back to this temporary
 * loopback server. Nothing is deployed or permanently hosted on this port.
 */
export const CALLBACK_HOST = "127.0.0.1";
export const CALLBACK_PORT = 42_819;
export const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}/oauth/callback`;
