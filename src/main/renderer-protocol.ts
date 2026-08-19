import { join, resolve, sep } from "node:path";

import {
  RENDERER_HOST,
  RENDERER_ORIGIN,
  RENDERER_SCHEME,
  RENDERER_URL,
} from "@/shared/renderer-origin";

export { RENDERER_HOST, RENDERER_ORIGIN, RENDERER_SCHEME, RENDERER_URL };

const HAS_FILE_EXTENSION = /\.[^/]+$/;

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isRendererUrl(url: URL) {
  return url.protocol === `${RENDERER_SCHEME}:` && url.host === RENDERER_HOST;
}

/**
 * Relay's window only ever shows its own renderer. Clerk's sign-up page and every
 * OAuth provider are web pages that must open in the user's real browser, where their
 * existing sessions and password manager live — and where a phishing check is possible.
 * An unparseable or non-web target (`about:`, `file:`, a custom scheme) is neither
 * navigated to nor handed to the OS.
 */
export function shouldOpenInExternalBrowser(targetUrl: string) {
  const url = parseUrl(targetUrl);
  if (!url) return false;
  return !isRendererUrl(url) && (url.protocol === "https:" || url.protocol === "http:");
}

export function resolveRendererDevelopmentUrl(requestUrl: string, developmentServerUrl: string) {
  const request = parseUrl(requestUrl);
  if (!request || !isRendererUrl(request)) return null;

  const developmentUrl = parseUrl(developmentServerUrl);
  if (!developmentUrl) return null;
  developmentUrl.pathname = request.pathname;
  developmentUrl.search = request.search;
  return developmentUrl.toString();
}

export function resolveRendererFilePath(requestUrl: string, rendererDirectory: string) {
  const url = parseUrl(requestUrl);
  if (!url || !isRendererUrl(url)) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    // A stray `%` makes the path undecodable; there is no file it could mean.
    return null;
  }

  const rendererRoot = resolve(rendererDirectory);

  // A path with no file extension is an application route, not a built asset. Serving the
  // document for those means a hard navigation — Clerk redirecting, or a reload — renders
  // the app instead of 404ing, which previously left the window blank.
  if (!HAS_FILE_EXTENSION.test(decodedPath)) return join(rendererRoot, "index.html");

  const rendererFilePath = resolve(rendererRoot, decodedPath.slice(1));
  const isInsideRendererRoot = rendererFilePath.startsWith(`${rendererRoot}${sep}`);
  if (!isInsideRendererRoot) return null;
  return rendererFilePath;
}
