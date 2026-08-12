# Frontend architecture & source map

Relay organises frontend code by the domain that owns it, not by technical shape.
A vertical owns the behaviour, data usage, presentation, types, and tests that
change together. This mirrors the convention used in `scorebird-web`.

References:

- [The Vertical Codebase](https://tkdodo.eu/blog/the-vertical-codebase)

## Core rules

- **Change together, live together** — colocate code that changes for the same product reason.
- **Name the owner** — use product names such as `homework/`, `students/`, `insights/`; never a generic `features/` layer.
- **Nest capabilities** — smaller workflows live under their owner: `homework/builder/`, `homework/review/`, `students/history/`.
- **One source of truth** — no barrel `index.ts` files and no re-export hubs. Import from the direct path.
- **Compose verticals explicitly** — a vertical may import another when a real workflow requires it (`homework/builder` renders `homework/review`).
- **Keep composition above product code** — verticals never import from `app/`, `renderer/`, or `web/`.
- **Keep routes thin** — a route file adapts the URL to a vertical's component and nothing else.

## Source map

```txt
src/
  lib/                    product-agnostic helpers (cn, formatters, clock, storage)
  hooks/                  product-agnostic React hooks
  components/             generic presentation
    ui/                     shadcn design-system primitives
    charts/                 recharts wrappers
  shared/                 contracts shared across Electron processes (claude.ts)

  claude/                 the local Claude capability: bridge, availability, accounts, activity log
  settings/               appearance and workspace preferences
  homework/               homework vertical
    builder/                the teacher's brief + generation workflow
    review/                 draft review, publishing, the Claude island
    library/                published/draft listing and in-flight generation
    assignment/             who a homework goes to, and to which Miro board
    player/                 the shared wizard, widgets, marked review, telemetry
  students/               student profiles
    history/                lesson history page and its timeline
  submissions/            submission review drawer and teacher grading
  insights/               cross-submission analytics: findings, filter, tables
  today/                  the teacher's daily inbox, previewing insights/

  app/                    application-wide policy and composition
  renderer/               Electron renderer entry: routes/, router, main.tsx
  web/                    student player entry (standalone static site)
  main/, preload/         Electron main and preload processes
    main/claude/            the Claude CLI runtime and its accounts
    main/miro/              the Miro credential and board writes
  styles.css              design tokens and shared utilities
```

## Dependency direction

```txt
renderer/main.tsx | web/main.tsx
  -> renderer/routes/
    -> app/
      -> product verticals
        -> components/ + lib/ + hooks/ + shared/
```

| Importing module            | Allowed dependencies                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `lib/`, `hooks/`           | external packages and other product-agnostic modules             |
| `components/`              | `lib/`, `hooks/`                                                 |
| Product vertical           | `lib/`, `hooks/`, `components/`, `shared/`, other verticals       |
| `app/`                     | foundations and product verticals                                |
| `renderer/`, `web/`        | everything below them                                            |

## Aliases

Two aliases cover the whole repo, so no module ever reaches for `../../../`:

- `@/*` → `src/*`
- `@convex/*` → `convex/*` (the Convex functions live outside `src/`)

They are declared in `tsconfig.json`, `tsconfig.web.json`, `tsconfig.node.json`,
`electron.vite.config.ts`, `vite.web.config.ts`, and both vitest configs.

## Intentional decisions

- **The homework wizard is shared.** `homework/player/homework-wizard.tsx` is the
  single step-by-step surface. The student player, the teacher's draft preview,
  and the pre-generation builder preview all render it, so a draft can never look
  different from what the student receives.
- **The renderer uses memory history.** The packaged app is loaded from a `file:`
  URL where pushing paths is meaningless, so `renderer/router.tsx` uses
  `createMemoryHistory` and restores the last route from session storage.
- **Route failures stay inside the content area.** `defaultErrorComponent`
  renders `app/route-error-panel.tsx` so a failing page keeps the sidebar usable.
- **In-flight generation is server state.** Generation runs in the desktop
  process but is recorded in `aiJobs`, so `homework/library` can show what is
  still being written even after the teacher leaves the builder.
- **Several Claude logins, one workspace.** The CLI stores one account per config
  directory, so `main/claude/claude-connections.ts` keeps a machine-local list of
  connections and `ClaudeService` resolves `CLAUDE_CONFIG_DIR` per call. Data is
  unaffected: every account generates into the same Convex deployment.
- **Sign-in runs inside the app.** `claude auth login` opens the browser itself
  and then waits on stdin for the code the browser shows, so
  `main/claude/claude-login-session.ts` spawns it and relays that one code. Its
  output buffer is capped: the CLI is a TUI that repaints for the whole sign-in,
  so buffering all of it would grow without bound.
- **Each account's email comes from the CLI.** `claude auth status --json`
  reports the signed-in account for a given config directory, which is what the
  settings page shows instead of an opaque label.
- **Theme is one class.** `settings/theme.ts` toggles `dark` on the root element
  and is applied before the first render. The workspace chrome reads
  `--workspace-surface` / `--workspace-sidebar` rather than hex literals, so both
  themes are correct.
- **Settings is always reachable.** The sidebar account row routes to
  `/settings` in every Claude state, including "not installed" — otherwise a
  teacher without the CLI could never open appearance settings.
- **The worksheet is the format.** Activities carry a `set` (`title` + `task`), a
  homework carries `referenceRules`, a tense question carries a `timeline`, and
  `error_fix` is one sentence with one phrase flagged. All four mirror
  `past-tenses-nostalgia-practice.html`: named sets, a cheat sheet, an order strip
  behind the answer, and a diff. Every field is optional, so homework generated
  before them still renders.
- **The review renders the activity, not a transcript.** `QuestionWidget` takes a
  `marking` prop, so a marked answer is the real widget with the student's own
  attempt in place: the wrong option, gap, pair or phrase in red, the expected one
  beside it, and the explanation under it. Matching always falls back to the
  stacked list when marked — drawn connectors say which pair was made, never
  whether it was right.
- **Marking is per part.** `content.gradeResponseParts` returns one verdict per
  blank, gap or pair, so a partly right activity shows which part failed rather
  than one verdict for the whole thing. `normalizeText` forgives case, smart
  quotes, end punctuation and whether a negative was contracted — never the thing
  being taught.
- **Students see the reasons, behind their own token.** `submissions.review`
  requires the resume token, so a share link alone never exposes another
  student's work or the answer key.
- **One logo asset, tinted.** `components/relay-logo.tsx` draws the mark inline
  with `currentColor`, so the dark rail, a light surface and every per-homework
  badge share one path set. The mask id comes from `useId()` — SVG ids are
  document-global, and a repeated id makes later copies render through the first
  one's mask. The wordmark is real Inter text, not a bitmap.
- **Homework badges are hues, not pictures.** `homework-glyph.tsx` renders the
  Relay mark in a colour derived from the id, so a list stays scannable while the
  app still looks like one product.
- **A floating panel is out of flow.** The wizard's `floatingPanel` is absolutely
  positioned above the footer and the body reserves room for it, so a panel that
  grows never pushes the card's content down.
- **An edit outlives its island.** A rewrite is recorded in `aiJobs` as
  `kind: "question_rewrite"` before Claude starts, its steps are mirrored onto the
  row, and the finished suggestion is stored on it as JSON. Leaving the page or
  changing step no longer discards the work: the request keeps running in the
  desktop process, writes its result to the job, and the island reads it back
  wherever it mounts. Applying or discarding deletes the row.
- **The island is one element in five states.** `review/claude-question-island.tsx`
  is never unmounted between idle, composing, loading, result and applying: the
  same box springs to each next shape while content crossfades. Submitting
  collapses it to the idle pill carrying a pulse, so the preview comes back
  immediately and the request can still be edited or cancelled.
- **Miro goes through Claude, not through us.** Relay holds no Miro credential:
  homework is attached to a board by Claude using the teacher's own Miro MCP
  server — the same connection generation already reads boards with.
  `tool-policy.allowBoardAttachTools` lets that request read the board and create
  one card, and denies anything that would delete, move or edit what is already
  there. "The latest unit" is the most recently created frame.
- **A wait shows the work.** `claude/use-claude-progress.ts` turns the runtime
  event stream into one line — "Reading the Miro board" — for whichever request is
  in flight. The island's collapsed pill and the Miro button both show it, so a
  long job reads as progress rather than a hang.
- **No score while working.** The player shows points once, in the review, with
  the reasons. Per-step points turn a worksheet into a running tally.
- **Nothing forces an answer.** The player can skip a step and come back: the
  step rail is navigable, unanswered steps stay unfilled, and the last step lists
  what is still open. An empty answer is never sent, so a skipped question stays
  absent server-side rather than being graded as wrong.
- **Matching changes shape by container, not viewport.** Under 560px of *its own*
  width, `player/matching-widget.tsx` renders a stacked list instead of two
  columns joined by connectors. The teacher's preview column is as tight as a
  phone, and a media query would have left it drawing towers of three-word lines.
- **The island animates to a measured size.** `useContentSize` measures the
  arriving state in a layout effect, before paint, and only that state — a
  ResizeObserver reports after paint (the box sat at the old size, then jumped)
  and the wrapper briefly contains the outgoing state too (the box overshot, then
  came back). One spring, straight to the target.
- **Insights is filtered by URL.** `insights/insight-filter.ts` parses `student`,
  `range`, `from`, `to`, and `section` from the route's search params, and every
  query on the page takes the same filter, so the whole view answers one
  question. Today's "View all" buttons are just links carrying a `section`.
- **Findings are computed, not listed.** `dashboard.highlights` returns
  plain-language findings ranked by what needs attention — a skill slipping,
  answers waiting to be graded, a set abandoned — so which cards exist depends on
  what the work shows. Today renders the top three of the same query.
- **Icons take a colour, not an alpha.** `--ink-faint` and
  `--workspace-sidebar-icon` exist so a faint icon is a real colour; an alpha lets
  whatever sits behind it bleed through and reads as a rendering fault.
- **Panel edges are real borders.** `.panel` and the wizard card use `border`, not
  a `ring`/`box-shadow`. A ring paints outside the box and gets shaved off by any
  scrolling or clipping ancestor, which is what made borders look cut.
- **Naming.** Kebab-case file names; `type` over `interface`; named functions for
  `useEffect`/`useCallback` callbacks so effects describe themselves.
