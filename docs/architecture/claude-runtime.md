# Claude runtime architecture

The desktop integration is intentionally based on T3 Code's current Claude implementation at commit [`78f462c`](https://github.com/pingdotgg/t3code/tree/78f462c4e18c8ea5e5037dc916389a3b72246025).

## Reference mapping

| T3 Code reference | Pattern adopted here |
| --- | --- |
| [`ClaudeAdapter.ts`](https://github.com/pingdotgg/t3code/blob/78f462c4e18c8ea5e5037dc916389a3b72246025/apps/server/src/provider/Layers/ClaudeAdapter.ts) | Run `query()` as a host-owned lifecycle, consume its async message stream, and call `interrupt()`/`close()` for cancellation. |
| [`ClaudeExecutable.ts`](https://github.com/pingdotgg/t3code/blob/78f462c4e18c8ea5e5037dc916389a3b72246025/apps/server/src/provider/Drivers/ClaudeExecutable.ts) | Resolve the user's installed Claude executable and account for Windows npm launcher shims before passing `pathToClaudeCodeExecutable` to the SDK. |
| [`ClaudeHome.ts`](https://github.com/pingdotgg/t3code/blob/78f462c4e18c8ea5e5037dc916389a3b72246025/apps/server/src/provider/Drivers/ClaudeHome.ts) | Preserve `HOME` so macOS Keychain OAuth remains available; use `CLAUDE_CONFIG_DIR` only when an isolated Claude profile is explicitly configured. |
| [`ClaudeTextGeneration.ts`](https://github.com/pingdotgg/t3code/blob/78f462c4e18c8ea5e5037dc916389a3b72246025/apps/server/src/textGeneration/ClaudeTextGeneration.ts) | Require schema-constrained output and validate the result again at the process boundary. |

T3 Code supports a general coding-agent control surface. Relay deliberately narrows that model:

- Claude runs only in Electron's main process.
- The renderer receives a typed preload API, never Node.js or Claude credentials.
- Sessions are ephemeral and not persisted by the Agent SDK.
- Manual lesson generation and submission summarization expose no tools.
- Miro generation exposes only the `miro` MCP server and denies tool names that indicate mutation.
- Miro URL elicitation opens in the system browser; non-HTTPS elicitation is declined.
- Every result is validated against the shared schemas before it can be saved to Convex.
- Convex records the input snapshot, provider, lifecycle state, draft, and questions.

## Two request shapes

Both go through `runStructuredRequest`, which owns the process lifecycle,
cancellation, and the timeout:

| Request | Tools | Turn budget | Output schema |
| --- | --- | --- | --- |
| `generateHomework` | none, or read-only Miro MCP | 8, or 16 with Miro | `homeworkDraftSchema` |
| `summarizeSubmission` | none | 4 | `submissionSummarySchema` |

Turn budgets are deliberately loose. The model frequently spends a reasoning turn
before emitting structured output, and a tight budget surfaces as a
"Reached maximum number of turns" failure rather than a retry.

## JSON Schema compatibility

Zod 4 emits Draft 2020-12 by default, and the Claude CLI cannot resolve that
metaschema URI — it rejects the request before generation starts. `outputSchema.ts`
converts to Draft-07 and strips `$schema`; `outputSchema.test.ts` asserts no
`$schema` key survives at any depth.

## Runtime flow

1. The renderer creates a pending Convex AI job.
2. The renderer invokes the typed preload bridge.
3. Electron main starts the Claude Agent SDK with the user's installed Claude Code executable.
4. Claude reads the student's stored context, their previous focus areas, the teacher's notes, and — when requested — read-only Miro context.
5. Runtime events are reduced to safe progress events for the renderer.
6. The structured output is validated with Zod.
7. Convex stores a review-required homework draft and its questions.
8. Cancellation interrupts and closes the SDK query, then marks the Convex job cancelled.

## Prompt-injection stance

Lesson notes, student context, Miro content, and student answers are all treated
as untrusted data. The system prompt and both user prompts state this explicitly,
and the summarization path has no tools at all, so a student cannot cause a tool
call by writing one into an answer box.

Authentication remains owned by Claude Code. The application never copies OAuth tokens, cookies, or subscription credentials.
