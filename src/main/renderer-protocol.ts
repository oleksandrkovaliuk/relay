import { resolve, sep } from "node:path";

export const RENDERER_SCHEME = "relay";
export const RENDERER_HOST = "renderer";
export const RENDERER_URL = `${RENDERER_SCHEME}://${RENDERER_HOST}/`;
/**
 * The origin Chromium reports for renderer pages, and therefore the value Clerk's
 * responses must allow. It has no trailing slash — an origin never does.
 */
export const RENDERER_ORIGIN = `${RENDERER_SCHEME}://${RENDERER_HOST}`;

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

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const rendererRoot = resolve(rendererDirectory);
  const rendererFilePath = resolve(rendererRoot, relativePath);
  const isInsideRendererRoot = rendererFilePath.startsWith(`${rendererRoot}${sep}`);
  if (!isInsideRendererRoot) return null;
  return rendererFilePath;
}
