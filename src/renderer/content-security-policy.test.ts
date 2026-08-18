import { describe, expect, it } from "vitest";

import rendererDocument from "./index.html?raw";

describe("renderer Content Security Policy", () => {
  it("allows Clerk scripts from development and production Frontend API hosts", () => {
    expect(rendererDocument).toContain("https://*.clerk.accounts.dev");
    expect(rendererDocument).toContain("https://clerk.relay.democrat");
  });

  it("allows Clerk abuse-protection scripts and frames", () => {
    expect(rendererDocument).toContain("https://challenges.cloudflare.com");
    expect(rendererDocument).toContain("https://*.protect.clerk.com");
    expect(rendererDocument).toContain("frame-src 'self'");
  });
});
