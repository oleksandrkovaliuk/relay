import { execFile } from "node:child_process";
import { extname } from "node:path";
import { promisify } from "node:util";

import { claudeAccountSchema, type ClaudeAccount } from "@/shared/claude";

const execFileAsync = promisify(execFile);
const STATUS_TIMEOUT_MILLISECONDS = 15_000;

/**
 * `claude auth status --json` reports the signed-in account for whichever config
 * directory it runs against, which is how one login is told apart from another.
 * It exits non-zero when nobody is signed in.
 */
export async function readClaudeAccount({
  executablePath,
  environment,
  configDir,
}: {
  executablePath: string | null;
  environment: NodeJS.ProcessEnv;
  configDir: string | null;
}): Promise<ClaudeAccount | null> {
  if (!executablePath) return null;

  const isJavaScriptEntry = extname(executablePath).toLowerCase() === ".js";
  const command = isJavaScriptEntry ? process.execPath : executablePath;
  const commandArguments = isJavaScriptEntry
    ? [executablePath, "auth", "status", "--json"]
    : ["auth", "status", "--json"];

  try {
    const { stdout } = await execFileAsync(command, commandArguments, {
      env: configDir ? { ...environment, CLAUDE_CONFIG_DIR: configDir } : environment,
      timeout: STATUS_TIMEOUT_MILLISECONDS,
      windowsHide: true,
    });
    const parsed: unknown = JSON.parse(stdout);
    const account = claudeAccountSchema.safeParse(parsed);
    if (!account.success || !account.data.loggedIn) return null;
    return account.data;
  } catch {
    // A non-zero exit means "not signed in", which is a normal state here.
    return null;
  }
}
