# Frontend architecture & source map

ERM organises frontend code by the domain that owns it, not by technical shape.
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

  claude/                 the local Claude capability: bridge, availability, activity log
  homework/               homework vertical
    builder/                the teacher's brief + generation workflow
    review/                 draft review and publishing
    library/                published/draft listing and in-flight generation
    player/                 the shared homework wizard, widgets, telemetry
  students/               student profiles
    history/                lesson history page and its timeline
  submissions/            submission review drawer and teacher grading
  insights/               cross-submission analytics
  today/                  the teacher's daily inbox

  app/                    application-wide policy and composition
  renderer/               Electron renderer entry: routes/, router, main.tsx
  web/                    student player entry (standalone static site)
  main/, preload/         Electron main and preload processes
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
- **Naming.** Kebab-case file names; `type` over `interface`; named functions for
  `useEffect`/`useCallback` callbacks so effects describe themselves.
