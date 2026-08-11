import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, extname, isAbsolute, join, win32 } from "node:path";

interface ResolveClaudeExecutableOptions {
  configuredPath?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  isExecutableFile?: (filePath: string) => boolean;
}

const WINDOWS_COMMAND_EXTENSIONS = [".exe", ".cmd", ".bat"] as const;
const WINDOWS_SHIM_EXTENSIONS = new Set([".cmd", ".bat", ".ps1"]);

function isExecutableFile(filePath: string) {
  try {
    accessSync(filePath, constants.X_OK);
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function pathCandidates(command: string, environment: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
  if (isAbsolute(command)) return [command];

  const pathDirectories = (environment.PATH ?? "").split(delimiter).filter(Boolean);
  const commandExtensions = platform === "win32" ? WINDOWS_COMMAND_EXTENSIONS : [""];
  return pathDirectories.flatMap((directory) =>
    commandExtensions.map((extension) => join(directory, `${command}${extension}`)),
  );
}

function commonClaudePaths(homeDirectory: string, platform: NodeJS.Platform) {
  if (platform === "win32") {
    return [
      join(homeDirectory, ".local", "bin", "claude.exe"),
      join(homeDirectory, "AppData", "Roaming", "npm", "claude.cmd"),
    ];
  }

  return [
    join(homeDirectory, ".local", "bin", "claude"),
    join(homeDirectory, ".npm-global", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];
}

function resolveWindowsSdkEntry(filePath: string, fileExists: (filePath: string) => boolean) {
  const extension = extname(filePath).toLowerCase();
  if (!WINDOWS_SHIM_EXTENSIONS.has(extension)) return filePath;

  const shimDirectory = win32.dirname(filePath);
  const packageEntries = [
    win32.join(
      shimDirectory,
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    ),
    win32.join(
      shimDirectory,
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "cli.js",
    ),
  ];

  return packageEntries.find(fileExists) ?? null;
}

export function resolveClaudeExecutable(options: ResolveClaudeExecutableOptions = {}) {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? homedir();
  const fileExists = options.isExecutableFile ?? isExecutableFile;
  const configuredPath = options.configuredPath?.trim() || environment.CLAUDE_BINARY_PATH?.trim();
  const configuredCandidates = configuredPath
    ? pathCandidates(configuredPath, environment, platform)
    : [];
  const candidates = [
    ...configuredCandidates,
    ...pathCandidates("claude", environment, platform),
    ...commonClaudePaths(homeDirectory, platform),
  ];
  const executablePath = candidates.find(fileExists);

  if (!executablePath) return null;
  if (platform !== "win32") return executablePath;
  return resolveWindowsSdkEntry(executablePath, fileExists);
}
