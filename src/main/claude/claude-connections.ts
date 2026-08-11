import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  storedClaudeConnectionStateSchema,
  type StoredClaudeConnection,
  type StoredClaudeConnectionState,
} from "@/shared/claude";

const DEFAULT_CONNECTION_ID = "default";
const MAXIMUM_CONNECTIONS = 8;

/**
 * The teacher's Claude logins. The CLI stores exactly one account per config
 * directory, so an extra account means an extra directory we point the CLI at
 * via `CLAUDE_CONFIG_DIR`. The list is machine-local by nature — the directories
 * only exist on this Mac — so it lives beside the app's other user data rather
 * than in Convex.
 */
export class ClaudeConnectionStore {
  private readonly stateFilePath: string;
  private readonly configRootPath: string;
  private state: StoredClaudeConnectionState;

  constructor({
    stateFilePath,
    configRootPath,
  }: {
    stateFilePath: string;
    configRootPath: string;
  }) {
    this.stateFilePath = stateFilePath;
    this.configRootPath = configRootPath;
    this.state = this.read();
  }

  list(): StoredClaudeConnectionState {
    return this.state;
  }

  /** Config directory of the active connection, or `null` for the CLI default. */
  activeConfigDir(): string | null {
    return this.state.connections.find((connection) => connection.isActive)?.configDir ?? null;
  }

  add(label: string): StoredClaudeConnectionState {
    if (this.state.connections.length >= MAXIMUM_CONNECTIONS) {
      throw new Error(`At most ${MAXIMUM_CONNECTIONS} Claude accounts can be connected.`);
    }
    const id = createConnectionId(label, this.state.connections);
    const configDir = join(this.configRootPath, id);
    mkdirSync(configDir, { recursive: true });

    // A freshly added account is not logged in yet, so it does not steal the
    // active slot until the teacher switches to it deliberately.
    return this.write({
      connections: [
        ...this.state.connections,
        { id, label: label.trim(), configDir, isActive: false },
      ],
    });
  }

  activate(id: string): StoredClaudeConnectionState {
    if (!this.state.connections.some((connection) => connection.id === id)) {
      throw new Error("That Claude account is no longer connected.");
    }
    return this.write({
      connections: this.state.connections.map((connection) => ({
        ...connection,
        isActive: connection.id === id,
      })),
    });
  }

  remove(id: string): StoredClaudeConnectionState {
    if (id === DEFAULT_CONNECTION_ID) {
      throw new Error("The default Claude login cannot be removed.");
    }
    const remaining = this.state.connections.filter((connection) => connection.id !== id);
    if (remaining.length === 0) throw new Error("At least one Claude account must remain.");

    // Removing the active account must leave exactly one active connection.
    const hasActive = remaining.some((connection) => connection.isActive);
    return this.write({
      connections: remaining.map((connection, index) => ({
        ...connection,
        isActive: hasActive ? connection.isActive : index === 0,
      })),
    });
  }

  find(id: string): StoredClaudeConnection {
    const connection = this.state.connections.find((candidate) => candidate.id === id);
    if (!connection) throw new Error("That Claude account is no longer connected.");
    return connection;
  }

  /**
   * The equivalent terminal command, kept only as a fallback for when the in-app
   * sign-in cannot run at all.
   */
  loginCommand(id: string): string {
    const connection = this.find(id);
    if (!connection.configDir) return "claude auth login";
    return `CLAUDE_CONFIG_DIR="${connection.configDir}" claude auth login`;
  }

  private read(): StoredClaudeConnectionState {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.stateFilePath, "utf8"));
      const state = storedClaudeConnectionStateSchema.parse(parsed);
      return withExactlyOneActive(state);
    } catch {
      return { connections: [createDefaultConnection()] };
    }
  }

  private write(state: StoredClaudeConnectionState): StoredClaudeConnectionState {
    this.state = withExactlyOneActive(storedClaudeConnectionStateSchema.parse(state));
    mkdirSync(dirname(this.stateFilePath), { recursive: true });
    writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), "utf8");
    return this.state;
  }
}

function createDefaultConnection(): StoredClaudeConnection {
  return {
    id: DEFAULT_CONNECTION_ID,
    label: "Default login",
    configDir: null,
    isActive: true,
  };
}

/** A malformed file must never leave the app with no account to run as. */
function withExactlyOneActive(state: StoredClaudeConnectionState): StoredClaudeConnectionState {
  const activeIndex = state.connections.findIndex((connection) => connection.isActive);
  const effectiveIndex = activeIndex === -1 ? 0 : activeIndex;
  return {
    connections: state.connections.map((connection, index) => ({
      ...connection,
      isActive: index === effectiveIndex,
    })),
  };
}

function createConnectionId(label: string, existing: StoredClaudeConnection[]) {
  const slug =
    label
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 32) || "account";
  if (!existing.some((connection) => connection.id === slug)) return slug;
  let suffix = 2;
  while (existing.some((connection) => connection.id === `${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}
