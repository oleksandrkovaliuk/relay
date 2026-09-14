# Navigation and homework follow-up — 9 September 2026

## Changes

- Retain up to 100 idle reactive queries for ten minutes, scoped to the Clerk session. Keep the student list and homework overview queries subscribed while the workspace is open.
- Release cached subscriptions and hover preloads on session teardown. Deduplicate repeated hover/focus preloads; preload the student name alongside their history.
- Remount student, submission and homework detail routes by entity. Clear inherited submission search when opening student history and reject submission details belonging to a different selected student.
- Remove the model picker and local model preference. All production Claude requests use Opus 5, including legacy requests naming another model.
- Isolate generation from personal Claude settings and memory. Resolve conflicting directions for item prompts, section coherence, explanations and rewrite output. Distinguish grammatical correctness from politeness and accept valid alternatives when the task permits them.
- Redesign drafts, running generations and student attempts as separate cards. Make draft review/delete and student progress actions visible; show answered counts and an accessible progress bar.
- Move Add student, New homework and Generate draft into page headers. Put Delete beside Publish and published-homework link, Miro and access controls in the same header area. Report clipboard failure explicitly.

## Verification

- `pnpm check` passes: TypeScript, 196 application/runtime tests, 55 Convex tests, desktop build and student-web build.
- Cache regression checks cover retained subscriptions, deduplicated preloads, separate submission identities, expiry, sign-out cleanup and reuse after cleanup.
- Runtime tests confirm legacy Sonnet/Haiku requests still dispatch Opus 5 with personal settings and memory disabled.
- Two live Opus 5 beginner generations passed the nine-activity structural check. The first sample exposed an overgeneralised explanation; revised guidance was tested in the second sample, which distinguishes valid-but-blunt language and accepts alternative request forms. Samples remain subject to teacher review.
- Native checks opened two different students' histories with the correct names, returned to populated student/homework lists, and confirmed Delete and Publish in the homework header and Opus 5 in the activity editor.
- The signed-in account had no running jobs or student attempts, so those populated card states were not exercised in the native app. Native screenshots were intermittently stale/blank after development rebuilds; exhaustive visual QA and published Miro/access flows remain unverified.

No live homework was published, deleted, or sent to students during this follow-up.
