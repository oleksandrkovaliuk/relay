---
name: setup-scorebird-skills
description: >-
  Sets up the repo-local docs required by Scorebird skills. Use when preparing a
  Scorebird codebase for agent work, adding project/task-manager context, or
  configuring prototype rules such as target branch, draft PR, test environment,
  handoff workflow, and per-commit session behavior.
disable-model-invocation: true
---

# Setup Scorebird Skills

Set up the docs that Scorebird skills rely on inside a target repo.

This is a prompt-driven setup skill. Inspect the repo first, propose defaults
from what you find, ask only for missing decisions, confirm the draft, then
write.

## What This Creates

- **Shared domain context** — root `CONTEXT.md` with Scorebird product language,
  if missing or approved by the user.
- **Project context** — `docs/agents/project.md` with repo, task-manager,
  board/dashboard, component, and default branch context.
- **Prototype context** — `docs/agents/prototype.md` with target branch, draft
  PR, test environment, handoff workflow, and same-session commit loop.

## Process

### 1. Inspect

Before asking questions, inspect the target repo:

- Current branch and `git remote -v`.
- Root `AGENTS.md` or `CLAUDE.md`, if present.
- Root `CONTEXT.md`, if present.
- Existing `docs/agents/` docs.
- PR templates, CODEOWNERS, deploy docs, CI workflows, package scripts, and
  README hints.
- Existing task-manager references in branches, commits, PR templates, or docs.

Summarize what already exists and what is missing.

If the target repo is this `scorebird-skills` registry, treat the run as a
workflow test unless the user explicitly says they want to configure this repo as
a target project. Do not write generated `docs/agents/` files or root
`CONTEXT.md` during a test run; report the draft and stop.

### 2. Ask Setup Questions

Ask these as a short list. Do not use a special questionnaire component.

- What is this repo/project, and which Scorebird surface does it own?
- What task manager, project, board/dashboard, or component should agents use
  when they need task context?
- Which target branch should every new prototype session branch from and open
  its draft PR into?
- Which manual workflow, CI workflow, environment, or build process should
  agents run or use to create the prototype handoff artifact?
- Where should agents find the resulting handoff link? Examples: GitHub Actions
  run, deployment dashboard, TestFlight, CI comment, or PR checks.
- What should agents do after each commit during the same prototype session?
  Examples: push branch, update draft PR body, rerun handoff workflow, refresh
  handoff link, notify in the same thread.
- What should agents do when task context, target branch, handoff workflow,
  handoff link, reviewer, PR-template convention, or notification details are
  missing?

Use repo inspection to propose defaults where the answer is obvious. Ask only
for values that cannot be inferred safely.

### 3. Confirm Draft

Before writing, show the user the planned contents for:

- `docs/agents/project.md`
- `docs/agents/prototype.md`
- `CONTEXT.md` changes, only if creating or updating shared Scorebird context

Write only after the user confirms.

### 4. Write Docs

Create or update `docs/agents/project.md`:

```md
# Project Context

## Project

- **Name:** <project name>
- **Surface:** <web app | admin app | mobile app | backend | package | tooling>
- **Purpose:** <short description>

## Task Context

- **Task manager:** <Jira | Linear | GitHub Issues | other | none>
- **Project/board/dashboard:** <link or name>
- **Component/area:** <optional task-manager component or label>
- **How to identify the active task:** <branch key | PR link | user-provided URL | search rule>

## Branching

- **Default working branch:** <branch>
- **Notes:** <repo-specific branch rules>
```

Create or update `docs/agents/prototype.md` from
[`prototype.md`](./prototype.md), filled with the user's answers.

Create root `CONTEXT.md` with shared Scorebird product context if missing and
approved. If `CONTEXT.md` already exists, append the shared context only once
under a clear marker.

### 5. Update Agent Guidance

If `AGENTS.md` or `CLAUDE.md` exists, add or update a short `## Agent docs`
section without duplicating content:

```md
## Agent docs

- Use `docs/agents/project.md` for repo-specific project, task-manager, board,
  component, and branch context.
- Use `docs/agents/prototype.md` before prototype work.
- Use root `CONTEXT.md` when Scorebird product language or domain behavior
  matters.
```

If neither file exists, ask before creating one.

### 6. Finish

Report exactly which docs were created or updated, and which Scorebird skills
can now rely on them.
