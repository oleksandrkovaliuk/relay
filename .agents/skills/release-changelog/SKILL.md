---
name: release-changelog
description: Generate a release-ready .changeset/*.md from Jira (UT, web app scope), run pnpm exec changeset version, and output public stakeholder copy in the WEB App format. Load when preparing a release.
---

# Release Changelog

Generate a release-ready `.changeset/*.md` from **Jira (UT, web app scope)**, run **`pnpm exec changeset version`** as soon as the draft is complete (no user confirmation step), then output **public stakeholder copy** in the **WEB App** format in the **same response**. Do **not** use `npx changelog`.

## Changesets workflow (no interactive bump)

Do **not** rely on interactive `changeset` when there is no TTY. Use:

1. **`pnpm exec changeset add --empty`** (or `npx changeset add --empty`) so the CLI creates the file.
2. Open the generated `.changeset/*.md` and set the frontmatter to the correct bump, e.g.  
   `"relay-teacher-desktop": patch` | `minor` | `major`  
   (derive from the **user-stated** target release version vs current `package.json` version—do not invent the target version).
3. Write the **body** after the frontmatter (see **Changeset body** below).
4. Immediately run **`pnpm exec changeset version`** (do not ask the user for permission). Prefer `pnpm exec`; `npx changeset version` is acceptable if that is what the project uses.

Do not create a new `.changeset/*.md` from scratch without running `add --empty` first.

## Agent flow

Work in **small steps**: one question in chat, wait for the reply, continue. Keep prompts short.

### Target release version (required)

- If the user **did not** state the target release version (e.g. `1.6.0` or patch `1.5.1`), **ask only**:

  **What’s the target release version for this release?**

  Do **not** preface that with a checklist of steps (changeset, Jira, `changeset version`, public copy), bracketed lists, or explanations of what you will or cannot infer from `package.json` or git. Wait for the answer; then continue the workflow.

- **Do not** infer or guess the target version from `package.json`, git tags, `git describe`, merge history, or commit messages (including `release: v…`). Those can be wrong, stale, or from another branch—this is an internal rule; do **not** explain it to the user unless they ask.
- After the user provides it, derive **patch / minor / major** for Changesets frontmatter from **that** version vs current `package.json`; do not ask for bump type separately.

### Inputs

- **Target release version** — user-supplied semver for this release (see **Target release version (required)** above).
- **Contributors** — current GitHub user when known, or names the user gives; ask only if needed.
- **Jira** — UT + web app; infer component/label from context. Try **Atlassian MCP** first for the current sprint.

### Jira MCP failure (required stop)

If **any** Atlassian/Jira MCP call returns an error (permission denied, auth, network, etc.):

1. **Stop immediately.** Do **not** run `changeset add`, do **not** infer issues from `git log`, commit messages, merge history, tags, or “what might be in this version.” Those are **not** acceptable fallbacks.
2. Ask **only** for the in-scope work in a form you can use—e.g. a pasted **tasks table** (issue key + title/summary), or a clear `UT-XXXX` list with enough detail to write one line per issue. Keep the prompt short.
3. If the user **does not** provide tasks/issues, **stop again** and ask once more. Do **not** proceed with the release workflow until you have that input.

After the user supplies the list, continue from **Jira via MCP, or user-provided list** (same steps as a successful MCP query).

### Non-negotiables

1. Changeset file is always created via **`changeset add --empty`**, then frontmatter + body edits.
2. **Run `changeset version` in the same turn** once the changeset draft is complete—no separate approval step.
3. **Repo [CHANGELOG.md](CHANGELOG.md)** reflects what **Changesets** writes. If the generated `##` entry has broken list markup (e.g. `- -` or incorrectly nested bullets), fix it before finishing. Do not replace repo `CHANGELOG.md` with the public WEB App layout unless the user asks. **Public wording** goes in **chat** (or where they specify) **in the same response as the version bump**.

### Steps

1. **Target release version** — must be explicit from the user; if not in the invocation, ask first and wait (see **Target release version (required)**). Contributors only if needed.
2. Jira via MCP, or **user-provided tasks table / issue list** after an MCP failure (see **Jira MCP failure**). Never substitute git history for Jira.
3. `pnpm exec changeset add --empty` → set bump in frontmatter → fill changeset body.
4. Newest `.changeset/*.md` (exclude `README.md`).
5. `# Changelog` at top of [CHANGELOG.md](CHANGELOG.md).
6. Tone check against recent [CHANGELOG.md](CHANGELOG.md) for the **changeset** body only.
7. Contributor rules per issue line when using Jira metadata.
8. **`pnpm exec changeset version`** immediately after the changeset is ready. No **`changeset publish`** unless asked.
9. In the **same message**, output **public stakeholder copy** using **Public format (WEB App)** below (not committed unless asked).

## Jira scope

- Project **UT** only; web app issues inferred from components/labels/sprint/fix version.
- **Current sprint:** dates include today, or active sprint on the UT board.

## Changeset body (repo / Changesets)

Do **not** put `### Patch Changes` / `### Minor Changes` / `### Major Changes` in the file body.

- Issue lines: `- ` + `[UT-XXXX](https://scorebird.atlassian.net/browse/UT-XXXX)` + short sentence + optional `([@handle](https://github.com/handle))`.
- Blank line, then `#### Summary`, then 2–5 bullets.

## Public format (WEB App) — stakeholder-only

Use this for **Slack / email / Notion** announcements. It does **not** replace the repo `CHANGELOG.md` structure unless the user requests that.

The **changeset body** (and resulting `CHANGELOG.md` entry) should still list **all** in-scope issues for an accurate engineering record. **Public WEB App copy is curated separately:** fewer bullets, higher signal, no obligation to mention every ticket.

### What belongs in Improvements / Features (lead with these)

- New or expanded **product capabilities** (flows, permissions, major UI areas, integrations users recognize).
- Changes that affect **who can do what** (e.g. super-admin, org access, requests).
- **User-visible reliability** when impact is clear: crashes, blocked flows, wrong data shown, modals stuck open, schedule/editor breakages.
- Cross-cutting work stakeholders would notice: **notifications**, **recording links**, **sport detection** in builders/scoreboard—not every small toggle copy tweak.

### What to demote or move to Technical / “also included”

- **Purely technical** work (contracts, operators, internal plumbing) unless framed as a **user-visible outcome** (e.g. “notification support” not “event contract consumer”).
- **Minor polish**: spacing, formatting-only fixes (e.g. phone `+` alignment), tiny copy tweaks, icon swaps, “removed info icon” unless part of a larger story.
- **Narrow edge cases** with low business visibility—unless the user base hits them often.

Use a dedicated subsection so nothing “vanishes”:

**`Technical & other updates`** (or **`Also included`**) — short bullets, can batch related items (“Various Default Sport toggle and validation fixes in Overlay Builder and Virtual Scoreboard”) instead of one line per minor fix.

### Filtering discipline

- **Do not** bury **high-impact bugs** (crashes, data loss risk, broken checkout-style flows) in Technical just because they sound “technical.”
- When unsure: **prefer one honest line in Improvements** over hiding a real user pain.
- It is fine for **Improvements / Features** to be short while **Technical & other updates** carries the long tail.

**Structure**

1. **Title line:** `WEB App v{major}.{minor}.{patch}`  
   Optional trailing emoji on the same line for special releases (e.g. `:christmas_tree:`).
2. Blank line.
3. **`Improvements`** (section header, no `###` required in chat—plain text is fine).
4. Themed **subsections** with **Title Case** names (e.g. `User Access & Requests`, `Sign-in & Onboarding`, `Devices & Scheduling`, `UI & Notifications`). Match tone from past public posts: short, user-facing, **no Jira keys** unless you explicitly want them.
5. Under each subsection: bullet lines (leading `-` in markdown). Group related items; use **`[SA]`**-style role tags when the product uses them.
6. Blank line between subsection blocks.
7. **`Features`** when the release adds larger feature areas—repeat subsection pattern (e.g. **Overlay Builder**, **Virtual Scoreboard** on their own lines, then bullets).
8. **`Technical / Refactoring`** for large refactors, infra, or auth—same bullet style—**or** use **`Technical & other updates`** / **`Also included`** for the long tail of minor fixes and internal work (see **curation** above).
9. Optional closing line with emoji for seasonal / milestone messages.
10. Use **sentence-style** bullets (capital first letter, period optional but be consistent with the example release).

**Reference shape** (pattern only):

```text
WEB App v1.5.0

Improvements
User Access & Requests

- Added …
- [SA] Added …
- Updated …


Sign-in & Onboarding

- Added …
- Fixed …


Features
Overlay Builder

- Added …

Virtual Scoreboard

- Added …
```

Mirror density and grouping from recent public releases: prefer **Improvements** for fixes and polish, **Features** for new capability areas, split builders vs scoreboard when both change.

## Rules

- **Never** infer the release’s Jira issue list from git commits, merges, or `CHANGELOG.md` diffs when Jira MCP fails—use **Jira MCP** or **user-supplied tasks** only (see **Jira MCP failure**).
- **Never** choose or assume the target release version without the user stating it (or confirming it in reply). If omitted, ask with the single question under **Target release version**—nothing else—before doing release work.
- Verbs first in changeset issue lines. No “Thanks …” in changeset. No `#### Contributors` in changeset.
- **Bump** in frontmatter must match semver implied by the **user-provided** target version.
- **Changeset / `CHANGELOG.md`:** complete list of in-scope issues. **Public WEB App copy:** curated; prioritize stakeholder-relevant items; demote minor or internal items per **curation** (do not drop serious bugs from the main narrative by mistake).

## Optional

If the team fixes a canonical Jira **component** or **label** for “web app”, note it under **Jira scope**.
