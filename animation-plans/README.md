# Animation improvement plans

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | Draw the active match from the pointer | HIGH | DONE |
| 002 | Make the review sheet dismiss reliably | HIGH | DONE |
| 003 | Add boundary-aware scroll fades | MEDIUM | DONE |

## Recommended execution order

1. `001-matching-gesture-curve.md` — highest-value interaction feedback and independent of the shell.
2. `002-review-sheet-dismissal.md` — fixes a reported dismissal failure and establishes drawer timing tokens.
3. `003-boundary-scroll-fades.md` — uses the final sheet/shell structure and shared timing tokens.

## Dependencies

- Plans 001 and 002 both add `--ease-out`; the second executor must reuse the existing token if plan 001 runs first.
- Plan 003 should run after plan 002 so the scroll wrapper targets the final review sheet structure.
- No plan may add a motion dependency.
