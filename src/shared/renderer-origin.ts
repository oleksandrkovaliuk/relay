/**
 * The renderer is served from a custom scheme rather than `file://` so Clerk sees one
 * stable, secure origin in development and production alike. Both processes need these:
 * the main process registers and serves the scheme, and the renderer hands Clerk the
 * protocol so it will accept an in-app redirect. Keeping them here avoids importing
 * main-process modules — which reach for `node:path` — into the renderer bundle.
 */
export const RENDERER_SCHEME = "relay";
export const RENDERER_HOST = "renderer";
/** An origin has no trailing slash; this is the value Clerk's responses must allow. */
export const RENDERER_ORIGIN = `${RENDERER_SCHEME}://${RENDERER_HOST}`;
export const RENDERER_URL = `${RENDERER_ORIGIN}/`;
