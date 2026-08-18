import { resolve, sep } from "node:path";

export const RENDERER_SCHEME = "relay";
export const RENDERER_HOST = "renderer";
export const RENDERER_URL = `${RENDERER_SCHEME}://${RENDERER_HOST}/`;

function isRendererUrl(url: URL) {
  return url.protocol === `${RENDERER_SCHEME}:` && url.host === RENDERER_HOST;
}

export function resolveRendererDevelopmentUrl(requestUrl: string, developmentServerUrl: string) {
  const request = new URL(requestUrl);
  if (!isRendererUrl(request)) return null;

  const developmentUrl = new URL(developmentServerUrl);
  developmentUrl.pathname = request.pathname;
  developmentUrl.search = request.search;
  return developmentUrl.toString();
}

export function resolveRendererFilePath(requestUrl: string, rendererDirectory: string) {
  const url = new URL(requestUrl);
  if (!isRendererUrl(url)) return null;

  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const rendererRoot = resolve(rendererDirectory);
  const rendererFilePath = resolve(rendererRoot, relativePath);
  const isInsideRendererRoot = rendererFilePath.startsWith(`${rendererRoot}${sep}`);
  if (!isInsideRendererRoot) return null;
  return rendererFilePath;
}
