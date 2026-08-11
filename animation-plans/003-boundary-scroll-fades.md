# 003 — Add boundary-aware scroll fades

- **Status**: DONE
- **Commit**: unversioned
- **Severity**: MEDIUM
- **Category**: State indication; accessibility; performance
- **Estimated scope**: 3–6 files, medium reusable component

## Problem

Long panes are clipped by their containers with only a subtle scrollbar. There is no edge cue that content continues, and persistent gradients would be incorrect at the actual start/end boundaries.

```tsx
// src/renderer/src/components/WorkspaceShell.tsx:124 — current
<main ref={contentRef} className="scrollbar-subtle min-w-0 overflow-y-auto bg-background">
  {children}
</main>
```

```tsx
// src/renderer/src/components/SubmissionDetail.tsx:91 — current
<div className="scrollbar-subtle flex-1 overflow-y-auto px-6 py-6 sm:px-7 sm:py-7">
```

```css
/* src/ui/styles.css:204 — current */
.scrollbar-subtle {
  scrollbar-color: color-mix(in oklch, var(--foreground) 16%, transparent) transparent;
  scrollbar-width: thin;
}
```

## Target

- Create one reusable vertical scroll-fade wrapper that owns a scroll viewport and two pointer-events-none overlays.
- Use `scrollTop`, `scrollHeight`, and `clientHeight` to show the top fade only when `scrollTop > 1`, and bottom fade only when `scrollTop + clientHeight < scrollHeight - 1`.
- Recalculate on scroll and with `ResizeObserver` for both viewport and its content. No polling and no rAF loop.
- Each overlay is **24px** high, uses a gradient from the local surface color to transparent, and transitions only `opacity` for **150ms** with `ease`.
- The wrapper accepts `viewportRef`, viewport class name, and an optional semantic element so the Workspace main and review drawer can use it without invalid nesting.
- Use it for every actual custom vertical scroll viewport in the teacher app. For horizontal overflow tables, create the equivalent left/right form only if a custom horizontal viewport exists.
- Under `prefers-reduced-motion: reduce`, keep the same opacity cue but reduce transition duration to **100ms**; there is no movement to remove.

```css
/* target */
.scroll-fade-edge {
  pointer-events: none;
  position: absolute;
  inset-inline: 0;
  height: 24px;
  opacity: 0;
  transition: opacity 150ms ease;
}
.scroll-fade-edge[data-visible="true"] { opacity: 1; }
```

## Repo conventions to follow

- Shared presentational components live in `src/ui/components`.
- Use `cn` from `src/ui/lib/utils.ts` for class merging.
- Use the existing `scrollbar-subtle` utility; scroll fades complement it rather than replace it.
- `WorkspaceShell.tsx:40-44` needs an imperative ref for scroll-to-top. Preserve that through a forwarded or callback ref.

## Steps

1. Add `src/ui/components/ScrollFade.tsx` with a small hook that tracks start/end boundary state using scroll events and `ResizeObserver`.
2. Add the four fade utility styles (vertical top/bottom and optional horizontal left/right) to `src/ui/styles.css`; transitions must list `opacity` only.
3. Wrap the WorkspaceShell main scroll viewport and preserve its `contentRef.current?.scrollTo({ top: 0 })` behavior.
4. Wrap SubmissionDetail's scroll viewport and ensure fades sit below the fixed header and above content without blocking clicks.
5. Search for remaining `overflow-y-auto`, `overflow-auto`, and `overflow-x-auto` in teacher/player UI; apply the component only to true constrained custom scroll areas, not the document/body.
6. Confirm gradients use the nearest surface token so they do not show white strips over muted panels.

## Boundaries

- Do NOT add permanent fades that remain visible at the start or end.
- Do NOT hide native scrollbars.
- Do NOT use CSS masks that fade actual content or reduce text contrast.
- Do NOT listen on `window` when the viewport element can be observed directly.
- Do NOT animate height, background-position, or other painted/layout properties.
- Do NOT add a dependency.

## Verification

- **Mechanical**: run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm build:web`; all must exit 0.
- **Feel check**: verify the Workspace and review drawer at top, middle, and bottom. Top fade must be absent at top; bottom fade must be absent at bottom; both should show in the middle. Resize the window so content changes from non-scrollable to scrollable. At 10% playback, only opacity should change. Under reduced motion, fades must still communicate the boundary.
- **Done when**: every constrained custom scroll area has correct boundary cues, no fade blocks interaction, and no fade is shown when content fits.

## Completion evidence

- Verified the main workspace at top, middle, and bottom: fade states changed from `false/true` to `true/true` to `true/false` as expected.
- Added the same reusable boundary logic to the review drawer, draft sidebar, and horizontal Insights table; overlays remain pointer-events-none.
- `pnpm check` passed: TypeScript, 33 tests, Electron build, and web build.
