/**
 * Diagnostics that cannot take the app down.
 *
 * A packaged Relay launched from Finder has no terminal behind its stdio, and once that
 * pipe is gone every write to it fails. Node surfaces that as `write EIO` thrown straight
 * out of `console.error` — and main's loudest caller is the `console-message` handler that
 * forwards renderer warnings, so ordinary renderer noise became an uncaught exception and
 * a crash dialog. A lost log line is not worth a lost session: the write is attempted, and
 * if the pipe is broken it is never attempted again.
 */
type Sink = (...args: unknown[]) => void;

let stdioIsBroken = false;

/** Exposed for tests; a real run only ever moves this flag one way. */
export function resetDiagnosticLogForTests() {
  stdioIsBroken = false;
}

export function isStdioBroken() {
  return stdioIsBroken;
}

function write(sink: Sink, args: unknown[]) {
  if (stdioIsBroken) return;
  try {
    sink(...args);
  } catch {
    stdioIsBroken = true;
  }
}

export function logError(...args: unknown[]) {
  write(console.error.bind(console), args);
}

export function logWarning(...args: unknown[]) {
  write(console.warn.bind(console), args);
}

/**
 * A closed pipe can also fail after the write is dispatched, and an `error` event with no
 * listener is itself an uncaught exception — so both streams get one, whether or not
 * anything has logged yet.
 */
export function guardDiagnosticStreams(
  streams: { on: (event: "error", listener: () => void) => unknown }[] = [
    process.stdout,
    process.stderr,
  ],
) {
  for (const stream of streams) {
    stream.on("error", () => {
      stdioIsBroken = true;
    });
  }
}
