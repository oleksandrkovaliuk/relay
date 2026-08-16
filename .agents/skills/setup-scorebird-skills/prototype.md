# Prototype

Read this file before starting prototype work.

Use it as the source of truth for prototype branch base, draft PR rules, handoff
workflow, handoff link, and same-session commit loop. Follow additional
references in this file only when they are relevant to the prototype at hand.

## Session Model

Each new prototype session starts from the configured target branch.

For each session:

- Create one new prototype branch from the target branch.
- Open one draft PR from that prototype branch back into the target branch.
- Keep all prototype commits for the session on that branch.
- Keep updating the same draft PR during the session.
- Do not open duplicate PRs for the same prototype session.
- Do not merge or mark the PR ready unless the user explicitly changes the goal.

## Target Branch

- **Target branch:** <fill during setup>

## Branch Format

- **Prototype branch format:** <contributor>/prototype/<slug>[/<ticket>]

## Draft PR

- **PR base:** <same as target branch unless setup says otherwise>
- **PR title prefix:** [Prototype]
- **PR state:** draft
- **Reviewer:** CODEOWNER
- **PR body:** follow the repo's PR template/convention if one exists

## Handoff Workflow

- **Workflow/environment/build:** <manual workflow, CI workflow, test env, deployment process, TestFlight, QA build, or other handoff path>
- **How to run/use it:** <fill during setup>
- **Where to find handoff link:** <GitHub Actions run, deployment dashboard, TestFlight, CI comment, PR checks, or other source>

The review artifact is the handoff link produced by this workflow, such as a
deployed test environment link, TestFlight link, or build link. Do not handoff a
localhost URL as the review link.

## Verification

Run the narrowest meaningful checks for the touched area before handoff. Record
pre-existing failures separately from prototype regressions.

- **Commands/checks:** <lint | typecheck | tests | browser smoke | mobile smoke | other>

## After Each Commit

After each commit during the same prototype session:

- Push the prototype branch.
- Update the same draft PR if the decision log, shortcuts, screenshots, or
  handoff details changed.
- Run or trigger the configured handoff workflow before handoff and when needed
  after later commits.
- Refresh the handoff link when the workflow produces a new one.
- Notify only through the configured channel/thread/rule, if one exists.

## Missing Context

When task context, target branch, handoff workflow, handoff link, reviewer,
PR-template convention, or notification details are missing:

- <ask user | continue until PR only | stop before handoff | other>
