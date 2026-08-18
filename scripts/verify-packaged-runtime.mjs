/**
 * Launches the real packaged Electron binary and waits for it to report that its
 * renderer loaded. Unit tests run against source modules and cannot see whether a
 * transitive runtime dependency made it into `app.asar` — that is how 0.3.1 shipped an
 * app that crashed on launch looking for `ajv`. The main process implements the
 * `--smoke-test` side of this handshake and exits 0 only once the window has loaded.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
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
 * Anchors on `app.asar`, which every platform's layout contains, instead of guessing the
 * executable's name. electron-builder derives that name differently per platform — macOS
 * and Windows use `productName`, Linux uses the package `name` — so a hardcoded guess
 * silently found nothing on Linux.
 */
function findPackagedExecutable() {
  const archivePath = newest(walk(DIST_DIRECTORY).filter((path) => basename(path) === "app.asar"));
  if (!archivePath) return undefined;

  // macOS: <root>/Relay.app/Contents/Resources/app.asar, and the launcher is the single
  // entry in Contents/MacOS.
  const macResources = `${sep}Contents${sep}Resources${sep}app.asar`;
  if (archivePath.endsWith(macResources)) {
    const appBundle = archivePath.slice(0, -macResources.length);
    const launcherDirectory = join(appBundle, "Contents", "MacOS");
    const launcher = readdirSync(launcherDirectory, { withFileTypes: true }).find((entry) =>
      entry.isFile(),
    );
    return launcher ? join(launcherDirectory, launcher.name) : undefined;
  }

  // Windows and Linux: <root>/resources/app.asar, with the executable directly in <root>.
  const appRoot = join(archivePath, "..", "..");
  const candidates = readdirSync(appRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  if (process.platform === "win32") {
    const executable = candidates.find((name) => name.toLowerCase().endsWith(".exe"));
    return executable ? join(appRoot, executable) : undefined;
  }

  // `chrome-sandbox` is the setuid helper, not the app; shared objects carry an extension.
  const executable = candidates.find(
    (name) => name !== "chrome-sandbox" && !name.includes(".") && isExecutable(join(appRoot, name)),
  );
  return executable ? join(appRoot, executable) : undefined;
}

function isExecutable(path) {
  return (statSync(path).mode & 0o111) !== 0;
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
