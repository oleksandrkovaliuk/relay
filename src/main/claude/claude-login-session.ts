import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { extname } from "node:path";

import type { ClaudeLoginEvent } from "@/shared/claude";

/** Terminal hyperlink wrappers the CLI prints around the sign-in URL. */
const OSC_HYPERLINK_PATTERN = /\u001b\]8;;(.*?)(?:\u0007|\u001b\\)/g;
const ANSI_PATTERN = /\u001b\[[0-9;]*[A-Za-z]/g;
const URL_PATTERN = /https:\/\/[^\s]*oauth[^\s]*/;
const CODE_PROMPT_PATTERN = /paste code/i;
const LOGIN_TIMEOUT_MILLISECONDS = 10 * 60 * 1_000;
/**
 * The CLI is an interactive TUI that redraws constantly, so its output is
 * effectively unbounded. Only a tail is ever needed to spot the URL and the code
 * prompt, and keeping just that tail stops the buffer growing for the whole
 * sign-in.
 */
const OUTPUT_TAIL_LIMIT = 8_192;

/**
 * Drives `claude auth login` from the app instead of asking the teacher to paste
 * a command into a terminal. Run headless the CLI opens the browser itself,
 * prints the sign-in URL, and then waits on stdin for the code the browser
 * shows — so the app only has to relay that one code back.
 */
export class ClaudeLoginSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private buffered = "";
  private hasReportedUrl = false;
  private hasReportedPrompt = false;

  constructor(private readonly emit: (event: ClaudeLoginEvent) => void) {}

  get isRunning() {
    return this.child !== null;
  }

  start({
    executablePath,
    environment,
    configDir,
    email,
  }: {
    executablePath: string | null;
    environment: NodeJS.ProcessEnv;
    configDir: string | null;
    email?: string;
  }) {
    if (!executablePath) {
      this.emit({ type: "failed", message: "Claude Code is not installed on this Mac." });
      return;
    }
    this.cancel();

    const loginArguments = ["auth", "login", "--claudeai", ...(email ? ["--email", email] : [])];
    const isJavaScriptEntry = extname(executablePath).toLowerCase() === ".js";
    const command = isJavaScriptEntry ? process.execPath : executablePath;
    const commandArguments = isJavaScriptEntry
      ? [executablePath, ...loginArguments]
      : loginArguments;

    const child = spawn(command, commandArguments, {
      env: configDir ? { ...environment, CLAUDE_CONFIG_DIR: configDir } : environment,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.buffered = "";
    this.hasReportedUrl = false;
    this.hasReportedPrompt = false;
    this.emit({ type: "started" });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.readOutput(chunk));
    child.stderr.on("data", (chunk: string) => this.readOutput(chunk));

    child.on("error", (error) => {
      this.finish({ type: "failed", message: error.message });
    });
    child.on("close", (code) => {
      if (this.child !== child) return;
      this.finish(
        code === 0
          ? { type: "completed" }
          : { type: "failed", message: "The sign-in did not complete." },
      );
    });

    this.timeoutHandle = setTimeout(() => {
      this.finish({ type: "failed", message: "The sign-in timed out." });
    }, LOGIN_TIMEOUT_MILLISECONDS);
  }

  /** Relays the code the browser displayed into the waiting CLI. */
  submitCode(code: string) {
    const child = this.child;
    if (!child) throw new Error("There is no sign-in in progress.");
    child.stdin.write(`${code.trim()}\n`);
  }

  cancel() {
    const child = this.child;
    this.clearTimeout();
    this.child = null;
    if (!child) return;
    child.stdout.removeAllListeners();
    child.stderr.removeAllListeners();
    child.removeAllListeners();
    child.kill();
  }

  private readOutput(chunk: string) {
    // Both signals arrive within the first moments; after that there is nothing
    // left to look for, so stop buffering and scanning entirely.
    if (this.hasReportedUrl && this.hasReportedPrompt) {
      this.buffered = "";
      return;
    }

    this.buffered = (this.buffered + chunk).slice(-OUTPUT_TAIL_LIMIT);
    const text = this.buffered.replaceAll(OSC_HYPERLINK_PATTERN, "$1").replaceAll(ANSI_PATTERN, "");

    if (!this.hasReportedUrl) {
      const url = extractSignInUrl(text);
      if (url) {
        this.hasReportedUrl = true;
        this.emit({ type: "browser_opened", url });
      }
    }
    if (!this.hasReportedPrompt && CODE_PROMPT_PATTERN.test(text)) {
      this.hasReportedPrompt = true;
      this.emit({ type: "code_requested" });
    }
  }

  private finish(event: ClaudeLoginEvent) {
    const child = this.child;
    this.clearTimeout();
    this.child = null;
    if (child) {
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeAllListeners();
      child.kill();
    }
    this.emit(event);
  }

  private clearTimeout() {
    if (this.timeoutHandle === null) return;
    clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }
}

/**
 * The CLI prints the sign-in URL twice back to back — once as the hyperlink
 * target and once as visible text — so a greedy match would return both glued
 * together. Keep the first complete URL, whether or not the terminal escapes
 * around it were recognised.
 */
export function extractSignInUrl(text: string) {
  const candidate = text.match(URL_PATTERN)?.[0];
  if (!candidate) return null;
  const [first] = candidate.split(/(?=https:\/\/)/).filter(Boolean);
  return first ?? null;
}
