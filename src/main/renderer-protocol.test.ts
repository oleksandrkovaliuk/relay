import { describe, expect, it } from "vitest";

import {
  RENDERER_ORIGIN,
  RENDERER_URL,
  resolveRendererDevelopmentUrl,
  resolveRendererFilePath,
  shouldOpenInExternalBrowser,
} from "./renderer-protocol";

const RENDERER_DIRECTORY = "/app/out/renderer";

describe("resolveRendererFilePath", () => {
  it("serves the renderer entrypoint from the protocol root", () => {
    expect(resolveRendererFilePath(RENDERER_URL, RENDERER_DIRECTORY)).toBe(
      "/app/out/renderer/index.html",
    );
  });

  it("serves renderer assets from the same secure origin", () => {
    expect(resolveRendererFilePath(`${RENDERER_URL}assets/app.js`, RENDERER_DIRECTORY)).toBe(
      "/app/out/renderer/assets/app.js",
    );
  });

  it("rejects other origins and paths outside the renderer directory", () => {
    expect(resolveRendererFilePath("relay://other/assets/app.js", RENDERER_DIRECTORY)).toBeNull();
    expect(
      resolveRendererFilePath(`${RENDERER_URL}%2e%2e%2fsecret.txt`, RENDERER_DIRECTORY),
    ).toBeNull();
  });

  it("normalises a literal traversal segment instead of escaping the renderer root", () => {
    // `relay` is a standard scheme, so the URL parser collapses `/../` before the
    // resolver runs. Percent-encoded traversal survives parsing and is what the
    // containment check above exists to reject.
    expect(resolveRendererFilePath(`${RENDERER_URL}../secret.txt`, RENDERER_DIRECTORY)).toBe(
      "/app/out/renderer/secret.txt",
    );
  });

  it("rejects a path that cannot be percent-decoded", () => {
    expect(resolveRendererFilePath(`${RENDERER_URL}%ZZ`, RENDERER_DIRECTORY)).toBeNull();
  });

  it("rejects an unparseable request url", () => {
    expect(resolveRendererFilePath("not a url", RENDERER_DIRECTORY)).toBeNull();
  });
});

describe("RENDERER_ORIGIN", () => {
  it("is the renderer url without the trailing slash an origin never has", () => {
    expect(RENDERER_ORIGIN).toBe("relay://renderer");
    expect(`${RENDERER_ORIGIN}/`).toBe(RENDERER_URL);
  });
});

describe("resolveRendererDevelopmentUrl", () => {
  it("proxies renderer paths and queries to the Vite development server", () => {
    expect(
      resolveRendererDevelopmentUrl(
        `${RENDERER_URL}@vite/client?direct=true`,
        "http://localhost:5173/",
      ),
    ).toBe("http://localhost:5173/@vite/client?direct=true");
  });

  it("rejects requests for another renderer host", () => {
    expect(
      resolveRendererDevelopmentUrl("relay://attacker/@vite/client", "http://localhost:5173/"),
    ).toBeNull();
  });

  it("rejects an unparseable request url or development server url", () => {
    expect(resolveRendererDevelopmentUrl("not a url", "http://localhost:5173/")).toBeNull();
    expect(resolveRendererDevelopmentUrl(RENDERER_URL, "not a url")).toBeNull();
  });
});

describe("shouldOpenInExternalBrowser", () => {
  it("keeps Relay renderer navigation inside the app", () => {
    expect(shouldOpenInExternalBrowser(RENDERER_URL)).toBe(false);
    expect(shouldOpenInExternalBrowser(`${RENDERER_URL}settings`)).toBe(false);
  });

  it("sends Clerk sign-up and OAuth pages to the system browser", () => {
    expect(shouldOpenInExternalBrowser("https://accounts.relay.democrat/sign-up")).toBe(true);
    expect(shouldOpenInExternalBrowser("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
  });

  it("does not launch unsupported protocols", () => {
    expect(shouldOpenInExternalBrowser("file:///etc/passwd")).toBe(false);
    expect(shouldOpenInExternalBrowser("about:blank")).toBe(false);
    expect(shouldOpenInExternalBrowser("javascript:alert(1)")).toBe(false);
    expect(shouldOpenInExternalBrowser("relay://renderer/../../etc/passwd")).toBe(false);
  });

  it("does not hand an unparseable target to the operating system", () => {
    expect(shouldOpenInExternalBrowser("")).toBe(false);
    expect(shouldOpenInExternalBrowser("not a url")).toBe(false);
  });
});
