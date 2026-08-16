---
name: prototype
description: >-
  Builds throwaway prototypes for product, UI, technical, or workflow
  exploration. Use when the user asks to prototype, spike, explore an idea,
  create a reviewable experiment, or iterate on an existing prototype.
---

# Prototype

Create a focused prototype for exploration and review.

## Required Setup

Before starting, read `docs/agents/prototype.md`.

Use that file as the source of truth for target branch, draft PR rules, handoff
workflow, handoff link, and same-session commit loop. Follow additional
references in that file only when they are relevant to the prototype at hand.

If `docs/agents/prototype.md` is missing or does not answer the details needed
for reliable prototype work, stop and ask the user to run
`setup-scorebird-skills`.

## Workflow

1. **Orient.** Read `docs/agents/prototype.md`, inspect the repo, and identify
   the nearest existing feature, route, component, service, or workflow to
   extend.

2. **Clarify only if needed.** If the brief is concrete, proceed. If the brief
   is vague, ask at most two targeted questions. If still vague, propose a small
   set of directions and let the user choose.

3. **Start session.** Branch from the configured target branch. Each new
   prototype session gets one new prototype branch and one draft PR.

4. **Build narrowly.** Reuse repo conventions, primitives, package manager,
   styling, data access, and test patterns. Avoid broad refactors, new
   dependencies, schema changes, or production behavior changes unless the user
   explicitly asks.

5. **Track decisions.** Keep a short decision log while working: assumptions,
   shortcuts, mocks, tradeoffs, and areas intentionally left untouched.

6. **Open draft PR.** Create one draft PR back into the configured target
   branch. Add CODEOWNER as reviewer. Follow the repo's PR template/convention
   if one exists.

7. **Verify.** Run the narrowest meaningful checks from
   `docs/agents/prototype.md` for the touched area. Separate pre-existing
   failures from regressions caused by the prototype.

8. **Create handoff artifact.** Run or use the configured workflow/environment
   from `docs/agents/prototype.md` and collect the resulting handoff link.

9. **Iterate in session.** After each commit in the same prototype session, push
   the same branch, update the same draft PR, refresh the handoff link when
   needed, and notify according to `docs/agents/prototype.md`.

10. **Hand off.** Share the draft PR, preview deploy link, verification
    results, and known shortcuts or unresolved questions. Do not use a localhost
    URL as the handoff link.

## Boundaries

- Do not merge prototype work or mark the PR ready unless the user explicitly
  changes the goal.
- Do not invent a handoff workflow, test environment, task-manager workflow, or
  notification channel.
- Do not open duplicate PRs for the same prototype session.
- If required handoff details are missing, follow the missing-context rule in
  `docs/agents/prototype.md`.
