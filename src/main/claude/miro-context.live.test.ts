import { tmpdir } from "node:os";
import { expect, it } from "vitest";

import { query, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import { ClaudeService } from "./claude-service";

/**
 * Answers one question: when the app spawns Claude for a Miro-sourced
 * generation, does the subprocess actually get the Miro MCP server, and does
 * board content reach the model? Wraps the real `query` so the app builds its
 * own options and we only observe.
 */
const BOARD_URL = process.env.MIRO_PROBE_BOARD ?? "https://miro.com/app/board/uXjVHyng4sM=/";

it("connects the Miro MCP server in the subprocess the app spawns", async () => {
  const mcpServerStates: unknown[] = [];
  const miroToolsOffered: string[] = [];
  const toolCalls: { name: string; ok: boolean; preview: string }[] = [];

  const observingQuery: typeof query = (args) => {
    const runtime = query(args) as Query;
    const original = runtime[Symbol.asyncIterator].bind(runtime);
    runtime[Symbol.asyncIterator] = async function* () {
      for await (const message of original() as AsyncGenerator<SDKMessage>) {
        const any = message as any;
        if (any.type === "system" && any.subtype === "init") {
          mcpServerStates.push(any.mcp_servers);
          for (const tool of any.tools ?? []) {
            if (String(tool).startsWith("mcp__miro__")) miroToolsOffered.push(String(tool));
          }
        }
        if (any.type === "assistant") {
          for (const block of any.message?.content ?? []) {
            if (block.type === "tool_use") toolCalls.push({ name: block.name, ok: true, preview: "" });
          }
        }
        if (any.type === "user") {
          for (const block of any.message?.content ?? []) {
            if (block.type !== "tool_result") continue;
            const last = toolCalls.at(-1);
            if (!last) continue;
            last.ok = !block.is_error;
            last.preview = JSON.stringify(block.content).slice(0, 300);
          }
        }
        yield message;
      }
    };
    return runtime;
  };

  const service = new ClaudeService({ workingDirectory: tmpdir(), createQuery: observingQuery });
  const availability = await service.checkAvailability();
  expect(availability.isAuthenticated).toBe(true);

  let generationError: string | null = null;
  try {
    await service.generateHomework(
      {
        requestId: crypto.randomUUID(),
        miroBoardUrl: BOARD_URL,
        lessonNotes: "",
        studentContext: "Adult B1 learner.",
        difficulty: "intermediate",
        targetSkills: ["reading"],
        activityPlan: [{ type: "short_answer", itemCount: 3 }],
        teachingStyle: { styleNotes: "", editInstructions: [], keptExamples: [] },
      },
      () => undefined,
    );
  } catch (error) {
    generationError = error instanceof Error ? error.message : String(error);
  }

  const say = (line: string) => process.stdout.write(`${line}\n`);
  say("===== MIRO CONTEXT REPORT =====");
  say("mcp_servers reported by the subprocess:");
  say(JSON.stringify(mcpServerStates, null, 2));
  say(`\nmcp__miro__* tools offered to the model: ${miroToolsOffered.length}`);
  say(miroToolsOffered.slice(0, 40).join("\n") || "  (none)");
  say(`\ntool calls attempted: ${toolCalls.length}`);
  for (const call of toolCalls) {
    say(`  ${call.ok ? "ok  " : "FAIL"} ${call.name} ${call.preview}`);
  }
  say(`\ngeneration error: ${generationError ?? "(none)"}`);
  say("===== END REPORT =====");
}, 300_000);
