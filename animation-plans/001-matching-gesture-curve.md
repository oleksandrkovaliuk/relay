# 001 — Draw the active match from the pointer

- **Status**: DONE
- **Commit**: unversioned
- **Severity**: HIGH
- **Category**: Missed opportunities; state indication; feedback
- **Estimated scope**: 2 files, medium interaction rewrite

## Problem

The matching widget only draws completed connections, and those connectors are rigid straight lines. After selecting a term, the visual state does not explain that the next click will complete the connection or connect the selected source to the user's pointer. Completed pairs also share one neutral color, so crossing lines are difficult to trace.

```tsx
// src/ui/player/QuestionWidgets.tsx:283 — current
<svg
  aria-hidden="true"
  focusable="false"
  className="pointer-events-none absolute inset-0 size-full"
>
  {connectors.map((connector) => (
    <line
      key={connector.key}
      x1={connector.fromX}
      y1={connector.fromY}
      x2={connector.toX}
      y2={connector.toY}
      stroke={connector.isActive ? "var(--color-accent)" : "var(--color-line-strong)"}
      strokeWidth={2}
      strokeLinecap="round"
    />
  ))}
</svg>
```

```tsx
// src/ui/player/QuestionWidgets.tsx:316 — current
className={cn(
  "relative z-10 flex min-h-12 rounded-lg border transition-colors",
  isActive
    ? "border-accent bg-accent-soft ring-2 ring-accent/25"
    : match
      ? "border-line-strong bg-surface"
      : "border-line-strong bg-surface hover:border-ink-muted hover:bg-plane",
)}
```

## Target

- While a left item is active and the user moves inside the matching group, render one live SVG `<path>` from that item's right-center anchor to the pointer. Pointer tracking is direct (no tween, no lag) so it remains 1:1 with the gesture.
- Replace every completed `<line>` with a cubic Bézier `<path>`. Use horizontal control points at 42% of the source-to-target distance, with a minimum 24px control offset. Add a deterministic 2–4px midpoint offset derived from pair index so curves feel lightly drawn instead of mechanically identical; do not add random values that change between renders.
- Assign pair colors from a fixed accessible palette of five CSS custom properties. The connector, source background/border/dot, and target background/border/dot for one pair must use the same color. Color must supplement, not replace, text and `aria-label` state.
- Active selection uses the source pair color. Hovering a right-side target during selection previews that same color on the target.
- Completed paths reveal through `stroke-dashoffset` for **160ms** with `var(--ease-out)`. This is a one-shot completion acknowledgment, not a slow draw. Existing paths never replay when another pair changes.
- Selection fills and borders use interruptible CSS transitions: `background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease`.
- Pressable matching controls use `transform: scale(.96)` on active for **120ms** with `var(--ease-out)`.
- Under `prefers-reduced-motion: reduce`, show the completed path immediately (no dash motion), retain the 150ms color transition, and keep direct pointer tracking.

```css
/* target tokens */
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --match-1: oklch(0.58 0.15 164);
  --match-2: oklch(0.59 0.13 252);
  --match-3: oklch(0.62 0.14 45);
  --match-4: oklch(0.58 0.15 318);
  --match-5: oklch(0.55 0.12 205);
}

.match-path[data-new="true"] {
  transition: stroke-dashoffset 160ms var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .match-path { transition: none; stroke-dashoffset: 0; }
}
```

## Repo conventions to follow

- Shared timing tokens live in `src/ui/styles.css:72-112`.
- The app uses CSS variables for theme compatibility and Tailwind classes for component states.
- `QuestionWidgets.tsx:216-255` already uses element refs plus `ResizeObserver` for connector geometry; extend that measurement model instead of adding a canvas or dependency.
- Preserve the current click and keyboard workflow: source first, target second, clear button as a sibling control.

## Steps

1. In `src/ui/styles.css`, add `--ease-out` and the fixed match palette to `:root`; add reusable matching path/press classes and reduced-motion handling.
2. In `src/ui/player/QuestionWidgets.tsx`, extend connector geometry with pair index/color and create a pure cubic-path helper.
3. Add pointer coordinates scoped to the matching group. Start updating only while a source is active; clear live coordinates on pointer leave, selection cancel, connect, or clear.
4. Render completed and live connections as SVG paths. Ensure path IDs/keys remain stable and only the newly completed pair gets the 160ms dash reveal.
5. Apply the shared pair color to matched/active source and target elements through CSS custom properties; add pointer-target preview without removing accessible labels or focus rings.
6. Keep all controls at least 44px tall and preserve read-only answer-key behavior.

## Boundaries

- Do NOT change answer data shape, scoring, telemetry, or Convex APIs.
- Do NOT add a motion, canvas, or SVG helper dependency.
- Do NOT animate pointer tracking or introduce spring lag.
- Do NOT animate layout properties.
- Do NOT alter unrelated question widgets except the open-response fixes explicitly requested in the same file.
- If the current geometry/ref implementation has drifted from the cited code, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `pnpm typecheck`, `pnpm test`, and `pnpm build:web`; all must exit 0.
- **Feel check**: run the student player with a matching question and confirm:
  - selecting a left item attaches a smooth curve to the pointer with no visible lag;
  - crossing completed connectors remain traceable because each endpoint and path shares a color;
  - completing one pair draws only that new path and does not replay earlier paths;
  - keyboard source/target selection and clear controls still work;
  - at 10% DevTools playback the final draw starts immediately and finishes without bounce;
  - with reduced motion, path movement is gone but endpoint color feedback remains.
- **Done when**: active and completed grouping is visually unambiguous at a glance, the connector follows the pointer only during selection, and all checks pass.

## Completion evidence

- Verified in the local student player at 1280×800: the live cubic path followed direct pointer coordinates with no tween, and two completed pairs retained distinct endpoint/path colors.
- Verified the shared keyboard/click workflow, clear controls, stable completed paths, and isolated new-path reveal in the DOM.
- `pnpm check` passed: TypeScript, 33 tests, Electron build, and web build.
