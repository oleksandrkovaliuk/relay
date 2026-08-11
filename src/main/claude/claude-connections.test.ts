import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { ClaudeConnectionStore } from "./claude-connections";

function createStore() {
  const root = mkdtempSync(join(tmpdir(), "erm-claude-connections-"));
  return {
    root,
    store: new ClaudeConnectionStore({
      stateFilePath: join(root, "claude-connections.json"),
      configRootPath: join(root, "claude-configs"),
    }),
  };
}

describe("ClaudeConnectionStore", () => {
  let root: string;
  let store: ClaudeConnectionStore;

  beforeEach(() => {
    ({ root, store } = createStore());
  });

  it("starts with the CLI's existing login as the active account", () => {
    const state = store.list();

    expect(state.connections).toHaveLength(1);
    expect(state.connections[0]).toMatchObject({
      id: "default",
      configDir: null,
      isActive: true,
    });
  });

  it("gives each added account its own config directory", () => {
    const state = store.add("Work account");
    const added = state.connections.at(-1);

    expect(added?.id).toBe("work-account");
    expect(added?.configDir).toBe(join(root, "claude-configs", "work-account"));
  });

  it("leaves a newly added account inactive until it is chosen", () => {
    const state = store.add("Work account");

    expect(state.connections.filter((connection) => connection.isActive)).toHaveLength(1);
    expect(state.connections.at(-1)?.isActive).toBe(false);
  });

  it("switches which config directory the CLI runs against", () => {
    store.add("Work account");
    expect(store.activeConfigDir()).toBeNull();

    store.activate("work-account");
    expect(store.activeConfigDir()).toBe(join(root, "claude-configs", "work-account"));
  });

  it("keeps exactly one account active when switching", () => {
    store.add("Work account");
    const state = store.activate("work-account");

    expect(state.connections.filter((connection) => connection.isActive)).toHaveLength(1);
  });

  it("hands over a login command scoped to the account's config directory", () => {
    store.add("Work account");

    expect(store.loginCommand("default")).toBe("claude auth login");
    expect(store.loginCommand("work-account")).toBe(
      `CLAUDE_CONFIG_DIR="${join(root, "claude-configs", "work-account")}" claude auth login`,
    );
  });

  it("re-points the active slot when the active account is removed", () => {
    store.add("Work account");
    store.activate("work-account");
    const state = store.remove("work-account");

    expect(state.connections).toHaveLength(1);
    expect(state.connections[0]?.isActive).toBe(true);
    expect(store.activeConfigDir()).toBeNull();
  });

  it("refuses to remove the default login so there is always somewhere to run", () => {
    expect(() => store.remove("default")).toThrow(/cannot be removed/);
  });

  it("avoids id collisions between accounts labelled the same", () => {
    store.add("Work");
    const state = store.add("Work");

    expect(state.connections.map((connection) => connection.id)).toEqual([
      "default",
      "work",
      "work-2",
    ]);
  });

  it("persists across restarts", () => {
    store.add("Work account");
    store.activate("work-account");

    const reopened = new ClaudeConnectionStore({
      stateFilePath: join(root, "claude-connections.json"),
      configRootPath: join(root, "claude-configs"),
    });

    expect(reopened.activeConfigDir()).toBe(join(root, "claude-configs", "work-account"));
    expect(JSON.parse(readFileSync(join(root, "claude-connections.json"), "utf8"))).toMatchObject({
      connections: [{ id: "default" }, { id: "work-account", isActive: true }],
    });
  });

  it("recovers from a corrupted state file instead of leaving no account", () => {
    const recovered = new ClaudeConnectionStore({
      stateFilePath: join(root, "missing", "claude-connections.json"),
      configRootPath: join(root, "claude-configs"),
    });

    expect(recovered.list().connections).toHaveLength(1);
    expect(recovered.activeConfigDir()).toBeNull();
  });
});
