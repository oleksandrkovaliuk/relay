import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { TokenStorage } from "@clerk/electron";

/**
 * Clerk's own `storage()` adapter encrypts tokens through Electron's `safeStorage`, which
 * is backed by the macOS Keychain. In an app that is not signed with a stable Developer ID
 * that means a Keychain password prompt on launch — and if it is dismissed, `safeStorage`
 * reports itself unavailable, tokens are silently never persisted, and the user can never
 * appear signed in.
 *
 * This stores the token in a JSON file in the app's own user-data directory instead. The
 * file is created 0600, so only the signed-in OS user can read it, and it drops the
 * `electron-store` dependency chain entirely.
 *
 * Trade-off: the token is at rest unencrypted rather than in the OS keystore. It is a
 * short-lived Clerk client JWT in a per-user directory. Once the app ships with a
 * Developer ID certificate, `storage()` from `@clerk/electron/storage` becomes prompt-free
 * and is the stronger choice.
 */
const FILE_MODE = 0o600;

type TokenFile = Record<string, string>;

/** Distinguishes concurrent writes from each other, and from another process's. */
let temporaryFileCounter = 0;

export function createFileTokenStorage(filePath: string): TokenStorage {
  /**
   * Clerk saves the rotating client JWT from inside its response pipeline, so several
   * saves can be in flight at once. Serialising them keeps a read-modify-write from
   * losing a concurrent update. A rejected operation must not stall the queue.
   */
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(operation: () => T) => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };
  const read = (): TokenFile => {
    let contents: string;
    try {
      contents = readFileSync(filePath, "utf8");
    } catch {
      // No file yet, or it is unreadable; either way there is no token to return.
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(contents);
      // A truncated or hand-edited file must not throw on every later read.
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          ([, value]) => typeof value === "string",
        ),
      ) as TokenFile;
    } catch {
      return {};
    }
  };

  const write = (tokens: TokenFile) => {
    mkdirSync(dirname(filePath), { recursive: true });
    // Write-then-rename, so a crash mid-write cannot leave a half-written token behind.
    // The temporary name is unique per write: a shared one let two concurrent writes
    // rename the same path, so one of them failed with ENOENT and lost the token.
    const temporaryPath = `${filePath}.${process.pid}.${(temporaryFileCounter += 1)}.tmp`;
    try {
      writeFileSync(temporaryPath, JSON.stringify(tokens), { mode: FILE_MODE });
      renameSync(temporaryPath, filePath);
      // `writeFileSync`'s mode is subject to umask, and rename preserves the source mode.
      chmodSync(filePath, FILE_MODE);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  };

  /**
   * Clerk awaits these from inside `__internal_onAfterResponse`. A rejection there breaks
   * its request pipeline, so Clerk never finishes loading and the app waits on
   * "Connecting securely…" forever, while the token silently fails to persist. Losing a
   * token means signing in again; throwing means the app never recovers, so failures are
   * reported and swallowed.
   */
  const attempt = (action: string, operation: () => void) =>
    serialize(() => {
      try {
        operation();
      } catch (cause) {
        console.error(`Could not ${action} the Clerk token at ${filePath}:`, cause);
      }
    });

  return {
    getItem(key) {
      return serialize(() => read()[key] ?? null);
    },
    setItem(key, value) {
      return attempt("save", () => write({ ...read(), [key]: value }));
    },
    removeItem(key) {
      return attempt("clear", () => {
        const tokens = read();
        if (!(key in tokens)) return;
        delete tokens[key];
        if (Object.keys(tokens).length > 0) write(tokens);
        else rmSync(filePath, { force: true });
      });
    },
  };
}
