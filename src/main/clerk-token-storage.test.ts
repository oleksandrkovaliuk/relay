import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileTokenStorage } from "./clerk-token-storage";

let directory: string;
let filePath: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "relay-token-storage-"));
  filePath = join(directory, "nested", "clerk-tokens.json");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("createFileTokenStorage", () => {
  it("round-trips a token, creating the directory on demand", async () => {
    const storage = createFileTokenStorage(filePath);

    await expect(storage.getItem("__clerk_client_jwt")).resolves.toBeNull();
    await storage.setItem("__clerk_client_jwt", "token-value");

    await expect(storage.getItem("__clerk_client_jwt")).resolves.toBe("token-value");
    await expect(
      createFileTokenStorage(filePath).getItem("__clerk_client_jwt"),
    ).resolves.toBe("token-value");
  });

  it("keeps every concurrent save, as Clerk writes from its response pipeline", async () => {
    // A shared temporary filename let two writes rename the same path: one failed with
    // ENOENT and its token was lost, which signed the user out at random.
    const storage = createFileTokenStorage(filePath);

    await Promise.all(
      Array.from({ length: 25 }, (_unused, index) => storage.setItem(`k${index}`, `v${index}`)),
    );

    for (let index = 0; index < 25; index += 1) {
      await expect(storage.getItem(`k${index}`)).resolves.toBe(`v${index}`);
    }
  });

  it("reports a write failure instead of rejecting, which would wedge Clerk", async () => {
    // Clerk awaits saveToken inside __internal_onAfterResponse; a rejection there stops it
    // ever finishing load, leaving the app on "Connecting securely…".
    const unwritable = join(directory, "file-where-a-directory-is-needed");
    writeFileSync(unwritable, "not a directory");
    const storage = createFileTokenStorage(join(unwritable, "clerk-tokens.json"));

    await expect(storage.setItem("a", "1")).resolves.toBeUndefined();
    await expect(storage.removeItem("a")).resolves.toBeUndefined();
    await expect(storage.getItem("a")).resolves.toBeNull();
  });

  it("leaves no temporary files behind", async () => {
    const storage = createFileTokenStorage(filePath);
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");

    expect(readdirSync(dirname(filePath)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("keeps the file readable only by its owner", async () => {
    const storage = createFileTokenStorage(filePath);
    await storage.setItem("a", "1");

    // eslint-disable-next-line no-bitwise
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it("keeps other keys when one is removed, and deletes the file once empty", async () => {
    const storage = createFileTokenStorage(filePath);
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");

    await storage.removeItem("a");
    await expect(storage.getItem("a")).resolves.toBeNull();
    await expect(storage.getItem("b")).resolves.toBe("2");

    await storage.removeItem("b");
    expect(() => readFileSync(filePath, "utf8")).toThrow();
  });

  it("removing an absent key is a no-op rather than an error", async () => {
    const storage = createFileTokenStorage(filePath);

    await expect(storage.removeItem("missing")).resolves.toBeUndefined();
  });

  it("treats a corrupted file as empty instead of throwing on every read", async () => {
    const storage = createFileTokenStorage(filePath);
    await storage.setItem("a", "1");
    writeFileSync(filePath, "{not json");

    await expect(storage.getItem("a")).resolves.toBeNull();
    // ...and recovers once written again.
    await storage.setItem("a", "2");
    await expect(storage.getItem("a")).resolves.toBe("2");
  });

  it("ignores non-string values that a hand-edited file might contain", async () => {
    const storage = createFileTokenStorage(filePath);
    await storage.setItem("a", "1");
    writeFileSync(filePath, JSON.stringify({ a: 42, b: "keep" }));

    await expect(storage.getItem("a")).resolves.toBeNull();
    await expect(storage.getItem("b")).resolves.toBe("keep");
  });
});
