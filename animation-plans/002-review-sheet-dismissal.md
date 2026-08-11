# 002 — Make the review sheet dismiss reliably

- **Status**: DONE
- **Commit**: unversioned
- **Severity**: HIGH
- **Category**: Physicality and origin; easing and duration; missed opportunities
- **Estimated scope**: 2 files, small-to-medium

## Problem

The submission detail is a spatial drawer, but it uses the generic standard curve and depends on the generated dialog close control. The user reports that the sheet does not close. The explicit close action is therefore both a functional and motion seam.

```tsx
// src/renderer/src/components/SubmissionDetail.tsx:43 — current
<Dialog
  open
  onOpenChange={(isOpen) => {
    if (!isOpen) onClose();
  }}
>
  <DialogContent
    className="top-0! right-0! bottom-0! left-auto! flex h-dvh w-full max-w-[min(620px,calc(100vw-1rem))] translate-x-0! translate-y-0! flex-col gap-0 overflow-hidden rounded-none! border-l border-border bg-background p-0 shadow-2xl duration-300! ease-[var(--ease-standard)] data-open:slide-in-from-right data-open:zoom-in-100! data-closed:slide-out-to-right data-closed:zoom-out-100! motion-reduce:duration-150! motion-reduce:data-open:slide-in-from-right-2 motion-reduce:data-closed:slide-out-to-right-2 sm:max-w-[620px]"
  >
```

```tsx
// src/ui/components/ui/dialog.tsx:64 — current
<DialogPrimitive.Close
  data-slot="dialog-close"
  render={
    <Button
      variant="ghost"
      className="absolute top-4 right-4 bg-secondary"
      size="icon-sm"
    />
  }
>
```

## Target

- Keep Base UI dialog semantics, Escape dismissal, and backdrop dismissal.
- In `SubmissionDetail`, disable the generated close button and render one explicit 44×44 close control in the header whose `onClick` calls `onClose` directly. It must also be a `DialogClose` primitive so Base UI state and focus restoration remain correct.
- Drawer open and close use **280ms** and `var(--ease-drawer)`. Enter from `translateX(100%)`; exit reverses the same path to `translateX(100%)`. Opacity may go from `.98` to `1`, but no scaling/zoom.
- Backdrop uses opacity only for **200ms** with `var(--ease-out)`.
- Under `prefers-reduced-motion: reduce`, the drawer uses a **150ms opacity-only** transition with no positional movement.
- The close button uses `transform: scale(.96)` for **120ms** with `var(--ease-out)` and never shows a persistent ring unless keyboard-focused.

```css
/* target tokens */
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

## Repo conventions to follow

- Base UI dialog wrappers live in `src/ui/components/ui/dialog.tsx` and expose `DialogClose`.
- Shared timing tokens live in `src/ui/styles.css:109-111`.
- The current sheet is controlled by `open` and closes by clearing `openSubmissionId` in `TodayFeed.tsx`; keep that ownership.

## Steps

1. Add `--ease-out` and `--ease-drawer` tokens to `src/ui/styles.css` if plan 001 has not already added `--ease-out`.
2. Update the generic backdrop to use a 200ms opacity transition with `var(--ease-out)` and a 150ms reduced-motion duration.
3. In `SubmissionDetail.tsx`, pass `showCloseButton={false}`, import `DialogClose`, and add a 44px explicit header close control that invokes `onClose` and retains the primitive close behavior.
4. Replace generic slide/zoom utility timing with a 280ms right-edge drawer transition using `var(--ease-drawer)`; remove zoom classes.
5. Add reduced-motion classes so the panel retains opacity feedback without translation.
6. Confirm outside click and Escape still route to `onOpenChange(false)` exactly once.

## Boundaries

- Do NOT change the feed's submission selection state model.
- Do NOT add a second close icon or leave the generated one enabled.
- Do NOT animate width, right, or other layout properties.
- Do NOT add a dependency.
- If Base UI's controlled close contract differs from the current wrapper, STOP and report instead of replacing the dialog library.

## Verification

- **Mechanical**: run `pnpm typecheck`, `pnpm test`, and `pnpm build`; all must exit 0.
- **Feel check**: open a submission, then verify the header close control, Escape, and backdrop each close it on first attempt; reopen rapidly and confirm the drawer reverses smoothly rather than restarting. At 10% playback, confirm the panel follows one right-edge path with no zoom. Under reduced motion, confirm there is no horizontal movement and the state change remains visible through opacity.
- **Done when**: all three dismissal paths work on the first attempt, focus returns to the feed action, and sheet motion is spatially consistent.

## Completion evidence

- Verified the explicit close button and Escape dismissal in the local teacher app; both removed the dialog on the first attempt after the exit transition.
- The controlled dialog now defers the parent close callback until the Base UI close transition completes, preventing the sheet from being cut off mid-exit.
- `pnpm check` passed: TypeScript, 33 tests, Electron build, and web build.
