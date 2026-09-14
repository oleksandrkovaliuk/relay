import { tmpdir } from "node:os";
import { expect, it, vi } from "vitest";
import type { query } from "@anthropic-ai/claude-agent-sdk";

import { ClaudeService } from "./claude-service";

it.each([undefined, "claude-sonnet-5", "claude-haiku-4-5"] as const)(
  "uses Opus 5 even when a legacy request supplies %s", async (model) => {
    const createQuery = vi.fn<typeof query>(() => { throw new Error("Captured request"); });
    const service = new ClaudeService({ workingDirectory: tmpdir(), binaryPath: "/test/claude", createQuery });
    await expect(service.generateHomework({
      requestId: "fixed-model", model, lessonNotes: "Polite requests at a station",
      difficulty: "beginner", targetSkills: [], activityPlan: [{ type: "fill_blank", itemCount: 3 }],
    }, () => undefined)).rejects.toThrow("Captured request");
    expect(createQuery.mock.calls[0]?.[0].options).toMatchObject({
      model: "claude-opus-5", settingSources: [], settings: { autoMemoryEnabled: false },
      tools: [], persistSession: false,
    });
  },
);
