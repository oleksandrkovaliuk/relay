# Workspace revision verification — 5 September 2026

## Automated checks

- TypeScript checks pass.
- 192 application/unit tests and 55 Convex tests pass.
- Desktop and student-web production builds pass.
- A live beginner generation test passes with the updated Claude service and strict output schema. The sample has nine activities across the three requested types, worked examples, reference notes, and the requested grammar focus. Generated exercises still need teacher review; this is one sample, not a quality guarantee.
- An earlier live sample omitted section instructions. The generation schema now requires them, while existing saved drafts remain compatible.
- The existing live rewrite test returned valid content both times. Its strict single-attempt assertion failed once (two structured-output calls), then passed on a diagnostic rerun (one call). Rewrite latency can still vary with model retries.

## Manual checks completed

Native Relay: Today, Students, creation of a synthetic learner, homework brief and level selection, activity counts and limit validation, background generation, Library, opening the generated draft, inline editor layout, Settings theme switching, sidebar collapse, and Insights learner/date filters.

Student browser: start homework, multiple choice, blank completion, incorrect feedback, correcting answers, matching, written response, saved answers after reload, submission, rating and note, and post-submission review. Small-screen review has no horizontal document overflow. Pending written answers no longer display a misleading zero score.

The teacher development URL displays a desktop-required screen without attempting Electron sign-in. This is a native-only entry point, not browser teacher authentication support.

## Remaining manual checks

After restarting Electron to load the changed main-process prompts, native computer-use attachment repeatedly timed out. The native edit/apply/discard/cancel, publish/share, and teacher submission-review flows have not completed manual verification. Miro read/write flows have not been exercised. Backend regression tests cover ownership, assignment recovery, rewrite cancellation and learning only from applied edits.

The first native-generated QA draft predates the main-process prompt refresh. Updated prompt verification used the actual Claude service directly through live tests.

## Synthetic data

The development account contains the synthetic learner `QA — Beginner travel` and an unpublished train-station draft. A separate ownerless seed fixture (`relay-qa-20260905-1805-synthetic`) was used for the browser submission and feedback checks. No homework links were sent to real students.
