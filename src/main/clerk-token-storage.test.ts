import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  it("round-trips a token, creating the directory on demand", () => {
    const storage = createFileTokenStorage(filePath);

    expect(storage.getItem("__clerk_client_jwt")).toBeNull();
    storage.setItem("__clerk_client_jwt", "token-value");

    expect(storage.getItem("__clerk_client_jwt")).toBe("token-value");
    expect(createFileTokenStorage(filePath).getItem("__clerk_client_jwt")).toBe("token-value");
  });

  it("keeps the file readable only by its owner", () => {
    const storage = createFileTokenStorage(filePath);
    storage.setItem("a", "1");

    // eslint-disable-next-line no-bitwise
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it("keeps other keys when one is removed, and deletes the file once empty", () => {
    const storage = createFileTokenStorage(filePath);
    storage.setItem("a", "1");
    storage.setItem("b", "2");

    storage.removeItem("a");
    expect(storage.getItem("a")).toBeNull();
    expect(storage.getItem("b")).toBe("2");

    storage.removeItem("b");
    expect(() => readFileSync(filePath, "utf8")).toThrow();
  });

  it("removing an absent key is a no-op rather than an error", () => {
    const storage = createFileTokenStorage(filePath);

    expect(() => storage.removeItem("missing")).not.toThrow();
  });

  it("treats a corrupted file as empty instead of throwing on every read", () => {
    const storage = createFileTokenStorage(filePath);
    storage.setItem("a", "1");
    writeFileSync(filePath, "{not json");

    expect(storage.getItem("a")).toBeNull();
    // ...and recovers once written again.
    storage.setItem("a", "2");
    expect(storage.getItem("a")).toBe("2");
  });

  it("ignores non-string values that a hand-edited file might contain", () => {
    const storage = createFileTokenStorage(filePath);
    storage.setItem("a", "1");
    writeFileSync(filePath, JSON.stringify({ a: 42, b: "keep" }));

    expect(storage.getItem("a")).toBeNull();
    expect(storage.getItem("b")).toBe("keep");
  });
});
