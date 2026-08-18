/**
 * Launches the real packaged Electron binary and waits for it to report that its
 * renderer loaded. Unit tests run against source modules and cannot see whether a
 * transitive runtime dependency made it into `app.asar` — that is how 0.3.1 shipped an
 * app that crashed on launch looking for `ajv`. The main process implements the
 * `--smoke-test` side of this handshake and exits 0 only once the window has loaded.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { basename, join, sep } from "node:path";
import { tmpdir } from "node:os";

const SMOKE_TEST_TIMEOUT_MS = 90_000;
const DIST_DIRECTORY = new URL("../dist/", import.meta.url).pathname;

/**
 * Linux build agents have no GPU and no setuid sandbox helper, so Electron aborts on
 * launch there without these. They apply to this check only — the shipped app keeps its
 * sandbox, which the renderer relies on.
 */
const LINUX_HEADLESS_SWITCHES =
  process.platform === "linux" ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] : [];

const executablePath = findPackagedExecutable();
if (!executablePath) {
  fail(`Could not find an unpacked Relay executable under ${DIST_DIRECTORY}.`);
}
console.log(`Smoke testing ${executablePath}`);

// A throwaway profile keeps the check from reading or corrupting a real installation's
// Clerk tokens, and keeps repeated runs independent of each other.
const userDataDirectory = mkdtempSync(join(tmpdir(), "relay-smoke-test-"));

try {
  const { exitCode, signal, timedOut, error } = await runSmokeTest(
    executablePath,
    userDataDirectory,
  );

  if (error) fail(`Could not launch packaged Relay: ${error.message}`);
  if (timedOut) {
    fail(`Packaged Relay did not finish its smoke test within ${SMOKE_TEST_TIMEOUT_MS}ms.`);
  }
  if (exitCode !== 0) {
    fail(`Packaged Relay exited with ${signal ? `signal ${signal}` : `code ${exitCode}`}.`);
  }
  console.log("Packaged runtime smoke test passed.");
} finally {
  rmSync(userDataDirectory, { recursive: true, force: true });
}

function runSmokeTest(command, userDataDir) {
  return new Promise((resolve) => {
    const argv = ["--smoke-test", `--user-data-dir=${userDataDir}`, ...LINUX_HEADLESS_SWITCHES];
    const child = spawn(command, argv, {
      stdio: "inherit",
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, SMOKE_TEST_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: 1, signal: null, timedOut: false, error });
    });
    child.on("exit", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode, signal, timedOut });
    });
  });
}

/**
 * Anchors on `app.asar`, which every platform's layout contains, then names the launcher
 * from electron-builder's documented defaults: macOS and Windows use `productName`, Linux
 * uses the package `name`. Scanning the directory for "something executable" instead picks
 * up Chromium's own helpers (`chrome-sandbox`, `chrome_crashpad_handler`), so the name is
 * derived rather than guessed — and a miss reports what it looked for.
 */
function findPackagedExecutable() {
  const archivePath = newest(walk(DIST_DIRECTORY).filter((path) => basename(path) === "app.asar"));
  if (!archivePath) return undefined;

  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  // macOS: <root>/Relay.app/Contents/Resources/app.asar
  const macResources = `${sep}Contents${sep}Resources${sep}app.asar`;
  if (archivePath.endsWith(macResources)) {
    const appBundle = archivePath.slice(0, -macResources.length);
    return expect(join(appBundle, "Contents", "MacOS", manifest.productName));
  }

  // Windows and Linux: <root>/resources/app.asar, launcher directly in <root>.
  const appRoot = join(archivePath, "..", "..");
  const launcherName =
    process.platform === "win32" ? `${manifest.productName}.exe` : manifest.name;
  return expect(join(appRoot, launcherName));
}

function expect(executablePath) {
  if (existsSync(executablePath)) return executablePath;

  const directory = join(executablePath, "..");
  const contents = existsSync(directory) ? readdirSync(directory).join(", ") : "(missing)";
  fail(`Expected the packaged launcher at ${executablePath}. That directory holds: ${contents}`);
}

/** Several `dir` builds can accumulate in `dist/`; the freshest is the one under test. */
function newest(paths) {
  return paths.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

function walk(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return [path, ...walk(path)];
    return [path];
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
