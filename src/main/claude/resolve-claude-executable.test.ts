import { describe, expect, it } from "vitest";

import { resolveClaudeExecutable } from "./resolve-claude-executable";

describe("resolveClaudeExecutable", () => {
  it("prefers an explicit executable path", () => {
    const configuredPath = "/custom/bin/claude";
    const result = resolveClaudeExecutable({
      configuredPath,
      environment: { PATH: "/usr/bin" },
      homeDirectory: "/Users/teacher",
      platform: "darwin",
      isExecutableFile: (candidate) => candidate === configuredPath,
    });

    expect(result).toBe(configuredPath);
  });

  it("finds Claude's native installer location when GUI PATH is minimal", () => {
    const nativeInstallerPath = "/Users/teacher/.local/bin/claude";
    const result = resolveClaudeExecutable({
      environment: { PATH: "/usr/bin" },
      homeDirectory: "/Users/teacher",
      platform: "darwin",
      isExecutableFile: (candidate) => candidate === nativeInstallerPath,
    });

    expect(result).toBe(nativeInstallerPath);
  });

  it("returns null when no executable can be found", () => {
    const result = resolveClaudeExecutable({
      environment: { PATH: "/usr/bin" },
      homeDirectory: "/Users/teacher",
      platform: "linux",
      isExecutableFile: () => false,
    });

    expect(result).toBeNull();
  });
});
