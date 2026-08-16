---
name: git-guardrails
description: Universal git safety rules. Blocks destructive commands and direct pushes to long-lived branches. Load before any git operation in this repo.
---

# Git Guardrails

Read this before running any `git` command. Applies to every agent (Claude, Cursor, Copilot, etc.) and every contributor — designer, engineer, AI assistant — without exception.

Derived from [mattpocock/skills/git-guardrails-claude-code](https://github.com/mattpocock/skills/tree/main/skills/misc/git-guardrails-claude-code). The original script lives at [`.agents/hooks/block-dangerous-git.sh`](../../hooks/block-dangerous-git.sh) for Claude Code users who want runtime enforcement on top of these rules.

## Hard rules — never do these

Refuse the operation and ask the user how to proceed instead.

| Command                                                                              | Why it's blocked                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `git push` to `main`                                                                | Long-lived branch. Only move via merged PRs.                                    |
| `git push --force` / `--force-with-lease` to any shared branch                       | Rewrites history other people have pulled.                                      |
| `git reset --hard` on a branch with work not committed elsewhere                     | Silent data loss.                                                               |
| `git clean -f` / `git clean -fd`                                                     | Deletes untracked files irreversibly — often someone's in-progress work.        |
| `git branch -D`                                                                      | Force-deletes a branch with unmerged commits. Use `-d` and resolve the warning. |
| `git checkout .` / `git restore .`                                                   | Discards every local change at once. Restore individual files instead.          |
| `git rebase -i` or `git commit --amend` on commits already pushed to a shared branch | Rewrites public history.                                                        |
| Skipping hooks: `--no-verify`, `--no-gpg-sign`, `-c commit.gpgsign=false`            | Bypasses checks that exist for a reason. Fix the underlying issue.              |
| `git config` changes                                                                 | Don't modify the user's git config.                                             |

## Soft rules — pause and confirm

Ask the user before running these:

- Deleting any branch that isn't yours, even with `-d`.
- Force-pushing your own feature branch when a teammate may also be working on it.
- Any `gh` command that closes, deletes, or force-merges a PR or issue.
- `git stash drop` / `git stash clear`.

## When you hit one of these

1. **Stop.** Don't retry in a different form.
2. **Explain** what you tried, which rule blocked it, and why.
3. **Ask** how the user wants to proceed — almost always there's a safer alternative (open a PR, rebase before push, restore a single file, etc.).

## Enforcement layers

1. **Self-restriction (primary).** This command is the source of truth. Every agent reads it and refuses the listed operations.
2. **Optional Claude Code runtime hook (defense in depth).** [`.claude/hooks/block-dangerous-git.sh`](../hooks/block-dangerous-git.sh) wired into `.claude/settings.json` blocks the same commands at tool-call time. Setup is documented in the script header.

GitHub branch protection on `main` is the recommended server-side backstop.
