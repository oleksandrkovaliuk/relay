import { describe, expect, it } from "vitest";

import {
  resolveRendererDevelopmentUrl,
  resolveRendererFilePath,
} from "./renderer-protocol";

const RENDERER_DIRECTORY = "/app/out/renderer";

describe("resolveRendererFilePath", () => {
  it("serves the renderer entrypoint from the protocol root", () => {
    expect(resolveRendererFilePath("relay://renderer/", RENDERER_DIRECTORY)).toBe(
      "/app/out/renderer/index.html",
    );
  });

  it("serves renderer assets from the same secure origin", () => {
    expect(resolveRendererFilePath("relay://renderer/assets/app.js", RENDERER_DIRECTORY)).toBe(
      "/app/out/renderer/assets/app.js",
    );
  });

  it("rejects other origins and paths outside the renderer directory", () => {
    expect(resolveRendererFilePath("relay://other/assets/app.js", RENDERER_DIRECTORY)).toBeNull();
    expect(
      resolveRendererFilePath("relay://renderer/%2e%2e%2fsecret.txt", RENDERER_DIRECTORY),
    ).toBeNull();
  });
});

describe("resolveRendererDevelopmentUrl", () => {
  it("proxies renderer paths and queries to the Vite development server", () => {
    expect(
      resolveRendererDevelopmentUrl(
        "relay://renderer/@vite/client?direct=true",
        "http://localhost:5173/",
      ),
    ).toBe("http://localhost:5173/@vite/client?direct=true");
  });

  it("rejects requests for another renderer host", () => {
    expect(
      resolveRendererDevelopmentUrl("relay://attacker/@vite/client", "http://localhost:5173/"),
    ).toBeNull();
  });
});
