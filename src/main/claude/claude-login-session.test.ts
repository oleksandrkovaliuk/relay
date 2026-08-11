import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { ClaudeLoginSession, extractSignInUrl } from "./claude-login-session";

const SIGN_IN_URL =
  "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&response_type=code";

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: (chunk: string) => void };
  kill: () => void;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: () => undefined });
  child.stderr = Object.assign(new EventEmitter(), { setEncoding: () => undefined });
  child.stdin = { write: vi.fn() };
  child.kill = vi.fn();
  return child;
}

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => createdChildren.at(-1)),
}));

const createdChildren: FakeChild[] = [];

async function startSession() {
  const { spawn } = await import("node:child_process");
  const child = createFakeChild();
  createdChildren.push(child);
  const events: unknown[] = [];
  const session = new ClaudeLoginSession((event) => events.push(event));
  session.start({
    executablePath: "/usr/local/bin/claude",
    environment: {},
    configDir: "/tmp/config",
  });
  expect(spawn).toHaveBeenCalled();
  return { session, child, events };
}

describe("ClaudeLoginSession", () => {
  it("reports the sign-in URL the CLI prints, unwrapped from its terminal hyperlink", async () => {
    const { child, events } = await startSession();

    child.stdout.emit(
      "data",
      `Opening browser to sign in…\n]8;;${SIGN_IN_URL}${SIGN_IN_URL}]8;;\n`,
    );

    expect(events).toContainEqual({ type: "browser_opened", url: SIGN_IN_URL });
  });

  it("asks the renderer for the code once the CLI waits for one", async () => {
    const { child, events } = await startSession();

    child.stdout.emit("data", "Paste code here if prompted > ");

    expect(events).toContainEqual({ type: "code_requested" });
  });

  it("relays the code to the waiting CLI on stdin", async () => {
    const { session, child } = await startSession();

    child.stdout.emit("data", "Paste code here if prompted > ");
    session.submitCode("  abc123  ");

    expect(child.stdin.write).toHaveBeenCalledWith("abc123\n");
  });

  it("does not grow its buffer while the CLI redraws indefinitely", async () => {
    const { session, child, events } = await startSession();

    child.stdout.emit("data", `visit: ${SIGN_IN_URL}\n`);
    child.stdout.emit("data", "Paste code here if prompted > ");
    // An interactive TUI keeps repainting for the whole sign-in.
    for (let repaint = 0; repaint < 500; repaint += 1) {
      child.stdout.emit("data", `[2K[1G spinner frame ${repaint} `.repeat(20));
    }

    const buffered = Reflect.get(session, "buffered");
    expect(typeof buffered).toBe("string");
    expect(String(buffered).length).toBe(0);
    // Both signals were reported exactly once despite the noise.
    expect(events.filter((event) => isType(event, "browser_opened"))).toHaveLength(1);
    expect(events.filter((event) => isType(event, "code_requested"))).toHaveLength(1);
  });

  it("keeps the buffer bounded before both signals arrive", async () => {
    const { session, child } = await startSession();

    for (let repaint = 0; repaint < 200; repaint += 1) {
      child.stdout.emit("data", "x".repeat(1_000));
    }

    expect(String(Reflect.get(session, "buffered")).length).toBeLessThanOrEqual(8_192);
  });

  it("keeps only the first URL when the CLI repeats it without escapes", () => {
    expect(extractSignInUrl(`visit: ${SIGN_IN_URL}${SIGN_IN_URL}`)).toBe(SIGN_IN_URL);
    expect(extractSignInUrl(`visit: ${SIGN_IN_URL}`)).toBe(SIGN_IN_URL);
    expect(extractSignInUrl("nothing to see here")).toBeNull();
  });

  it("reports failure when the CLI exits without completing", async () => {
    const { child, events } = await startSession();

    child.emit("close", 1);

    expect(events).toContainEqual({
      type: "failed",
      message: "The sign-in did not complete.",
    });
  });

  it("reports completion on a clean exit", async () => {
    const { child, events } = await startSession();

    child.emit("close", 0);

    expect(events).toContainEqual({ type: "completed" });
  });
});

function isType(event: unknown, type: string) {
  return typeof event === "object" && event !== null && Reflect.get(event, "type") === type;
}
