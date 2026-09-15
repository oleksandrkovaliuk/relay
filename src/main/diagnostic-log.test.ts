import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  guardDiagnosticStreams,
  isStdioBroken,
  logError,
  logWarning,
  resetDiagnosticLogForTests,
} from "./diagnostic-log";

beforeEach(() => resetDiagnosticLogForTests());
afterEach(() => vi.restoreAllMocks());

describe("diagnostic logging", () => {
  it("writes through to the console while stdio works", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("Renderer: something went wrong");
    expect(error).toHaveBeenCalledWith("Renderer: something went wrong");
  });

  it("survives a broken pipe instead of throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw Object.assign(new Error("write EIO"), { code: "EIO" });
    });
    expect(() => logError("Renderer: noise")).not.toThrow();
    expect(isStdioBroken()).toBe(true);
  });

  it("stops writing once the pipe is known to be broken", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("write EIO");
    });
    logError("first");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logError("second");
    logWarning("third");
    expect(error).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();
  });

  it("treats a late stream error as a broken pipe", () => {
    const listeners: (() => void)[] = [];
    guardDiagnosticStreams([{ on: (_event, listener) => listeners.push(listener) }]);
    expect(isStdioBroken()).toBe(false);
    for (const listener of listeners) listener();
    expect(isStdioBroken()).toBe(true);
  });
});
