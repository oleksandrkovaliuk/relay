#!/bin/bash
#
# Canonical source: .agents/hooks/block-dangerous-git.sh
# .claude/hooks/block-dangerous-git.sh is a symlink to this file — edit here.
#
# Claude Code PreToolUse hook that blocks dangerous git commands.
# Derived from https://github.com/mattpocock/skills/blob/main/skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh
# Adapted: pushes to Relay's long-lived branch only (main),
# not every `git push` — feature-branch pushes must succeed for the prototype workflow.
#
# Wire it up by adding to .claude/settings.json (project) — the path stays
# as .claude/hooks/... since that's where Claude looks; the symlink there
# resolves to this canonical file:
#
#   {
#     "hooks": {
#       "PreToolUse": [
#         {
#           "matcher": "Bash",
#           "hooks": [
#             { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh" }
#           ]
#         }
#       ]
#     }
#   }
#
# This is OPTIONAL — Claude-Code-only defense in depth on top of the self-restriction
# rules in .agents/skills/git-guardrails/SKILL.md. Cursor/Copilot/etc. rely on the command alone.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Patterns that are always destructive, regardless of target.
DANGEROUS_PATTERNS=(
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "push -f($| )"
  "--force-with-lease"
  "commit --amend"
  "rebase -i"
  "--no-verify"
  "--no-gpg-sign"
)

# Long-lived branches that must never be pushed to directly.
PROTECTED_BRANCH_PUSH_PATTERNS=(
  "git push[^|;&]* (origin )?main( |$)"
  "git push[^|;&]* HEAD:main"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE -e "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. See .agents/skills/git-guardrails/SKILL.md. Ask the user before retrying." >&2
    exit 2
  fi
done

for pattern in "${PROTECTED_BRANCH_PUSH_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE -e "$pattern"; then
    echo "BLOCKED: '$COMMAND' pushes directly to a protected long-lived branch. Open a PR instead. See .agents/skills/git-guardrails/SKILL.md." >&2
    exit 2
  fi
done

exit 0
