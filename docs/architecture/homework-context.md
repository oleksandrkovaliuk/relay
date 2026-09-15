# Homework context and editing

Each Claude request is a fresh session. Relay must supply context explicitly.

## Generation

The builder fetches `teaching.learnerContext` at send time for every selected learner. The query validates ownership, deduplicates IDs, reads a bounded recent submission history and allocates the context budget across the group. It excludes names from the combined learner evidence. The explicit lesson brief, selected level and activity plan are passed alongside that evidence.

`GenerationRunsProvider` fetches the current teaching style. Failure to load it fails visibly rather than silently generating without it. The complete request and selected assignee IDs are saved in the generation job. The draft recovers those assignees when opened after background generation.

The prompt distinguishes teaching quality from language complexity. Beginner work requires appropriate language, practical situations, scaffolding and transfer. Historical examples are weak style evidence; they cannot override the current brief or level.

New generation output requires section instructions on every question and 3–5 reference notes. The persisted draft schema still accepts older homework without these fields. These structural checks do not replace teacher review of linguistic accuracy and exercise quality.

## Activity edits

The editor stays underneath the selected activity. Claude receives the original generation context through the owner-checked `aiJobs.generationContext` query, the current teaching style, current question, homework summary and neighboring prompts. Old drafts without a snapshot remain editable from their current content.

The snapshot contains the submitted notes and learner evidence, not a transcript of Miro tool results. For Miro-only lessons, edits rely on the generated homework content for material retrieved from the board.

Revisions are persisted before presentation. Teachers can try the complete proposed widget, apply it, or discard it. Wording can also be edited directly. Cancelling a request cancels its runtime and job; a late response cannot complete a cancelled job.

Only applied rewrite instructions enter the bounded teaching profile. Discarded and failed suggestions do not become preferences. These are contextual examples, not universal rules for unrelated lessons.

## Runtime and performance

`pnpm dev:desktop` watches the main process and preload modules, so prompt changes reach the running Claude service. A renderer refresh alone does not reload main-process prompts.

Generation progress writes are deduplicated by visible status, rather than recording every text token. The builder mounts the sample player only on request. The editor uses normal document flow, with no measurement loop or animated width/height. Manual submission summaries fetch their inputs on demand; background summaries explicitly continue the queue after each attempt.

## Browser entry points

The teacher renderer depends on Electron's authentication and Claude bridges. Opening its development port in a plain browser displays a desktop-required page instead of mounting the Electron authentication provider. The separate student player remains browser-based.
