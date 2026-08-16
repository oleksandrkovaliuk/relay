---
name: to-pr
description: Use when the user asks to prepare, open, update, or publish a pull request for current work, including deciding whether to reuse the current branch or create a fresh one.
---

# To PR

Turn the current work into one appropriate pull request.

## Do

1. Read the local repo context before any branch, commit, push, or PR creation:
   - `AGENTS.md`
   - `CONTRIBUTING.md`
   - `.github/pull_request_template.md` when present
   - `.github/CODEOWNERS` when present
   - any repo-local docs referenced by those files that define branch, PR, label, assignee, reviewer, or release conventions
2. Inspect git state before acting: current branch, dirty files, upstream, fork point, commits, and open PRs.
3. Decide branch handling from context:
   - Reuse the current branch when it already cleanly represents this work.
   - Create a fresh branch when on a long-lived/base branch, when the current branch has an unrelated PR, or when mixing work would confuse review.
   - Ask once if the base branch or work scope is genuinely ambiguous.
4. Discover repository PR metadata before opening or updating the PR:
   - List existing labels from the repo, then select labels required by `CONTRIBUTING.md` or equivalent docs.
   - If this repo follows Scorebird conventions, every PR must have at minimum: origin label (`agent` for AI-authored work), type label (`bug`, `enhancement`, `refactor`, `prototype`, etc.), and size label (`size: XS` through `size: XXL`) based on changed line count.
   - Determine the responsible assignee from the current branch owner, PR author, user instruction, or repo convention. Do not leave the PR unassigned.
   - Determine reviewers from `CODEOWNERS` or repo docs before requesting review. If the only detected reviewer is also the assignee/author or GitHub refuses the request, report that explicitly.
5. Summarize the diff and commits in plain language.
6. Run the repo-defined quality gates. Record failures exactly; fix only failures caused by this work.
7. Open or update the PR using the repo's discovered structure:
   - Title must follow the documented PR title format, such as `type(area): imperative summary [issue]`.
   - Body must use the repo PR template when present, with all checklist items completed or explicitly explained.
   - Apply required labels before requesting review.
   - Apply the responsible assignee before requesting review.
   - Request reviewers only after required labels and assignee are present.
8. Verify the created or updated PR metadata with the hosting tool/API before reporting completion:
   - title
   - base/head branches
   - labels
   - assignees
   - reviewers or review-request status
   - PR URL
9. Report the PR URL, base/head branches, title, labels, assignee, reviewer status, and check results.

## Stop Conditions

- Do not create the PR until contribution guidelines and PR templates have been checked, unless they are missing. If missing, say so and proceed with best available repo conventions.
- Do not mark PR preparation complete while required labels or assignee are missing.
- Do not invent ad-hoc labels when the repo already has suitable labels. If required labels are missing from the repo, surface the gap and ask whether to create them.
