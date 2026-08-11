# Design QA — ERM Codex-style interface rebuild

## Source visual truth

- Primary Codex surface reference: `/Users/sasakovaluk/snapshots/Screenshot 2026-08-10 at 9.41.58 PM.png` (`2302 × 2058` pixels).
- Supporting Codex references:
  - `/Users/sasakovaluk/snapshots/Screenshot 2026-08-10 at 9.41.45 PM.png`
  - `/Users/sasakovaluk/snapshots/Screenshot 2026-08-10 at 9.41.52 PM.png`
  - `/Users/sasakovaluk/snapshots/Screenshot 2026-08-10 at 9.41.48 PM.png`
- User-reported problem-state references:
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_O0RVLL/Screenshot 2026-08-10 at 9.37.16 PM.png`
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_uSHJ5n/Screenshot 2026-08-10 at 9.38.58 PM.png`
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_mHTol1/Screenshot 2026-08-10 at 9.39.41 PM.png`
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_ZszpFK/Screenshot 2026-08-10 at 9.40.56 PM.png`
- Focused sidebar references from the final refinement:
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_uFK8ht/Screenshot 2026-08-10 at 10.11.12 PM.png` — compact identity/status row with a trailing help action.
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_kqRzBB/Screenshot 2026-08-10 at 10.11.37 PM.png` — flat compose action without a persistent button surface.
  - `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_C6KDKv/Screenshot 2026-08-10 at 10.11.52 PM.png` — the ERM identity block explicitly marked for removal.
- Normalized primary reference: `/Users/sasakovaluk/projects/erm/.design-qa/source-codex-browser-1280x800.png` (`1280 × 800` pixels), produced by downsampling the primary reference to `1280 × 1144` and taking a centered `1280 × 800` content crop.

The Codex screenshots are a style target from a different product and state. Comparison therefore judges hierarchy, typography, spacing, surfaces, control treatment, and interaction polish rather than identical copy or component placement.

## Rendered implementation evidence

- Local teacher app: `http://localhost:5173/`
- Fresh Electron Today view: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-electron-today-dark-sidebar.png`
- Fresh Electron ready-state onboarding: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-electron-onboarding-ready.png`
- Final minimal sidebar at the local reference viewport: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-sidebar-minimal-1280x720.jpg`
- Compact builder and restored dark sidebar: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-compact-builder-1280x800.jpg`
- First-run Claude setup: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-compact-onboarding-1280x800.jpg`
- Add-student modal: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-add-student-modal-1280x800.jpg`
- Today: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-today-1280x800.png`
- Builder: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-builder-1280x800.png`
- Draft review: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-draft-review-1280x800.png`
- Rewrite preview: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-draft-rewrite-1280x800.png`
- Insights: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-insights-1280x800.png`
- Submission drawer: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-review-drawer-1280x800.png`
- Local student player matching states:
  - `/Users/sasakovaluk/projects/erm/.design-qa/implementation-matching-live-1280x800.png`
  - `/Users/sasakovaluk/projects/erm/.design-qa/implementation-matching-pairs-1280x800.png`
- Local student player rewrite state: `/Users/sasakovaluk/projects/erm/.design-qa/implementation-rewrite-1280x800.png`

## Viewport, density, and state

- Teacher CSS viewport: `1280 × 800`; page `devicePixelRatio: 2`; browser capture output: `1280 × 800`. The browser capture API normalized the screenshot to CSS-pixel dimensions, so it was compared with the normalized `1280 × 800` source crop.
- Player capture output: `1280 × 720` from the same local in-app browser session.
- Theme: light.
- Teacher state: populated development workspace with live submissions, drafts, students, and Insights data.
- Student state: published eight-question assignment at matching activity 3 and rewrite activity 6.
- Horizontal overflow check: `documentElement.scrollWidth === innerWidth === 1280` on Today, Students, Homework, Insights, Builder, and Draft Review after fixes.

## Full-view comparison evidence

The normalized Codex reference and the current compact Builder screenshot were opened in the same comparison input. The final implementation carries the source's quiet off-white canvas, white grouped panels, section headings outside those panels, internal one-pixel dividers, left-aligned label/description hierarchy, right-side controls, minimal elevation, and restrained rounded geometry. The sidebar intentionally returns to the user's preferred charcoal treatment while inner pages retain the Codex grouped-row language. Today and Insights use the same system, so sections read as one workspace instead of unrelated card grids.

The app intentionally retains its domain-specific two-pane builder preview and teacher navigation. Those differ structurally from Codex settings, but use the same density, surface, typography, and control grammar. No persistent controls are cropped at the primary viewport.

The two focused sidebar references and the final local implementation were opened in the same comparison input. The implementation now follows their hierarchy rather than copying their light surface: a single flat compose row leads the navigation, the redundant product identity block is absent, and the bottom local-Claude capability uses one line with a status dot and trailing help glyph. The existing charcoal navigation remains intact as requested.

## Focused region comparison evidence

The focused Codex grouped-row crop (`source-codex-browser-1280x800.png`) was compared with the Assignment Brief group in `implementation-compact-builder-1280x800.jpg`. Labels, supporting copy, dividers, compact 32px preset controls, subtle borders, and restrained group radii are visibly aligned with the reference language. The drawer and rewrite screenshots were separately inspected at full readable scale because their critical details—close affordance, prompt/list separation, response sizing, and answer hierarchy—are not present in the Codex source.

## Required fidelity surfaces

- **Fonts and typography:** Inter Variable is loaded with optical sizing and antialiasing. Page headings, section headings, body copy, metadata, and controls use a consistent 13–29px hierarchy with stronger contrast and readable line-height. Long dynamic summaries clamp behind explicit expansion actions rather than becoming dense walls.
- **Spacing and layout rhythm:** 252px desktop navigation, consistent page insets, compact section rhythm, grouped surfaces, internal dividers, and the exact preset's 32px field/button scale match the latest brief. Critical dismiss controls retain larger hit areas. The builder grid was corrected so neither pane overflows at 1280px.
- **Colors and tokens:** neutral `#f7f7f6` workspace, soft neutral sidebar, white panels, high-contrast foreground, muted secondary text, and restrained emerald/red semantic states. Contrast remains legible without turning metadata into badges.
- **Image quality and asset fidelity:** the visual target contains no product imagery requiring reproduction. Visible UI symbols use the installed Hugeicons/Lucide libraries; there are no emoji, CSS-art illustrations, fake image placeholders, or handcrafted decorative SVG assets.
- **Copy and content:** live assignment/student copy is preserved. Numbered rewrite content is separated from the instruction and exposed as a semantic ordered list; word-count grammar is correct.
- **Icons:** icons are limited to navigation, status, and clear actions, share a restrained stroke treatment, and are not used as decorative AI flourishes.
- **States and accessibility:** keyboard-readable semantic controls, explicit labels, focus-visible states, reduced-motion handling, 44px targets, drawer Escape dismissal, and non-color text state remain intact.

## Primary interactions tested

- Navigated Today, Students, Homework, Insights, and New Homework.
- Reproduced the apparent Builder reload and proved it was layout shift, not a remount: the note value and focus survived while the previous student-context row displaced the field by hundreds of pixels.
- Re-tested the fixed student switch at the same viewport: note focus and value survived, main scroll remained stable, and the measured Lesson Notes shift was `0px`.
- Opened the bounded Saved student context disclosure and measured a 224px scroll viewport for 483px of content.
- Opened Add student in its Base UI dialog; verified autofocus, Escape dismissal, zero remaining dialogs, and focus restoration to the originating trigger.
- Completed first-run onboarding without Claude, reopened setup from the builder, and verified the explicit close path.
- Clicked the final flat `New homework` sidebar row and reached the Builder.
- Clicked the final one-line Claude status row, verified the setup dialog heading, then closed it successfully.
- Restarted the stale long-running Electron dev renderer, verified the desktop app paints normally, detected Claude Code `2.1.226`, and entered the workspace through the installed/authenticated onboarding state.
- Smoke-tested all five workspace destinations; every expected page heading rendered exactly once.
- Opened the first submission review; verified explicit close and Escape both dismiss on the first attempt after the exit transition.
- Verified workspace scroll fades at top (`false/true`), middle (`true/true`), and bottom (`true/false`).
- Selected a matching source, moved the pointer, and observed a live direct cubic path; completed two pairs and confirmed distinct path/endpoint colors.
- Reached the rewrite activity, confirmed semantic numbered list output, 168px initial response height, and `1 word` singular feedback.
- Opened a draft, selected activity 7, and confirmed the same rewrite structure in the teacher preview.
- Checked teacher and player console logs: zero errors and zero warnings.

## Findings

No actionable P0, P1, or P2 findings remain in the verified states.

## Comparison history

1. **[P2] Builder overflow at 1280px.** The first browser-rendered comparison showed the Student Preview clipped past the right edge because minimum grid tracks plus gap/padding exceeded the workspace width. Fixed by using zero-min/equal responsive tracks and smaller breakpoint spacing. Post-fix evidence: `implementation-builder-1280x800.png`; measured document width equals viewport width.
2. **[P1] Review sheet dismissal seam.** The user-reported state did not reliably close and generic zoom/slide motion could be cut off by immediate unmount. Fixed with a controlled Base UI exit, explicit 44px close, one right-edge path, and reduced-motion fallback. Post-fix evidence: `implementation-review-drawer-1280x800.png`; both close-button and Escape tests left zero dialogs.
3. **[P2] Dense rewrite prompt and oversized response field.** The problem-state screenshot combined the instruction and sentences into one wall of text and left a large empty textarea. Fixed with conservative prompt parsing, an ordered list, 168–320px auto-growth, and correct pluralization. Post-fix evidence: `implementation-rewrite-1280x800.png` and `implementation-draft-rewrite-1280x800.png`.
4. **[P2] Ambiguous matching feedback.** The problem-state screenshot used neutral endpoints and rigid connections. Fixed with direct pointer geometry, lightly offset cubic paths, five deterministic pair colors, tinted endpoints, and a single 160ms completion acknowledgment. Post-fix evidence: `implementation-matching-live-1280x800.png` and `implementation-matching-pairs-1280x800.png`.
5. **[P1] Student selection looked like a page reload.** The builder never remounted; selecting a student inserted a long multi-column context row above the active editor. At 1280px the Lesson Notes field previously moved from roughly 326px to 859px while its value, focus, and page scroll survived. Fixed by moving saved context and recent work into a closed disclosure below the selector, bounding expanded content, and keeping loading copy inside that disclosure. Post-fix measured shift: `0px`.
6. **[P2] Controls had drifted above the requested preset density.** Shared buttons, inputs, selects, tabs, builder rows, and modal actions now use the `b27IcKPL` 32px control scale. `shadcn info --json` resolves the exact preset with zero fallbacks.
7. **[P2] Add student interrupted the page hierarchy.** The inline creation form is now a compact Base UI dialog with native validation, autofocus, Escape/backdrop dismissal, and trigger-specific focus restoration.
8. **[P2] Claude status and absence had no coherent recovery flow.** The sidebar footer now describes local readiness without implying identity. A one-time setup dialog checks installation/authentication, links the official guide, supports retry and continue-without-Claude, and can be reopened from both the sidebar and Builder.
9. **[P1] Long-running Electron renderer was stale and blank during final QA.** The production builds and renderer URL were healthy, but the hour-old development process no longer painted after extensive HMR churn. The exact project Electron process was terminated gracefully and restarted; the fresh shell renders the onboarding and Today view with Claude ready. No code/runtime error remained in the fresh process.
10. **[P2] Sidebar identity and primary-action chrome remained too prominent.** The final focused reference comparison showed that the ERM/Teacher workspace block and white `New homework` pill competed with the navigation. The identity block is removed and the action is now a flat 40px compose row with hover/focus feedback only.
11. **[P2] Claude readiness still read like a two-line diagnostic panel.** The footer is now a single 40px capability row containing only `Claude`, a semantic readiness dot, and a trailing help icon. Its full installed/authenticated detail remains in the accessible label and setup dialog rather than the persistent sidebar.

## Follow-up polish

No P3 item is required for acceptance. A future pass can add a dedicated cancellation/archive model for abandoned student sessions, but that is backend workflow scope rather than a visual mismatch.

## Final student-centered workflow pass — August 10

### New source and implementation evidence

- Today source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_hd16no/Screenshot 2026-08-10 at 10.46.00 PM.png` (`1580 × 1994`).
- Today implementation: `/Users/sasakovaluk/projects/erm/.design-qa/today-student-centric-1580x1994-final.png` (`1580 × 1994`).
- Students source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_q1uiTl/Screenshot 2026-08-10 at 10.43.45 PM.png` (`1110 × 1066`).
- Students implementation: `/Users/sasakovaluk/projects/erm/.design-qa/students-1110x1066-final.png` (`1110 × 1066`).
- Homework source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_4wtvcj/Screenshot 2026-08-10 at 10.42.24 PM.png` (`1564 × 1406`).
- Homework implementation: `/Users/sasakovaluk/projects/erm/.design-qa/homework-library-1564x1406-final.png` (`1564 × 1406`).
- Insights source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_TPRyrd/Screenshot 2026-08-10 at 10.48.13 PM.png` (`1016 × 1542`).
- Insights implementation: `/Users/sasakovaluk/projects/erm/.design-qa/insights-1016x1542-final.png` (`1016 × 1542`).
- Codex timeline reference: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_DEpjKy/Screenshot 2026-08-10 at 10.40.38 PM.png`.
- Student history implementation: `/Users/sasakovaluk/projects/erm/.design-qa/student-history-1110x1066-final.png`; unanswered tail proof: `/Users/sasakovaluk/projects/erm/.design-qa/student-history-unanswered-1110x1066-final.png`.
- Builder implementation: `/Users/sasakovaluk/projects/erm/.design-qa/homework-builder-1440x1000-v2.png`.

Each source/implementation pair above was opened together in one comparison input at the same pixel dimensions where a like-for-like screen existed. Browser captures used `devicePixelRatio: 1`; the final `1110px` viewport also measured `documentElement.scrollWidth === innerWidth`, with no horizontal overflow.

### Visible comparison conclusions

- **Today:** replaced undifferentiated overview/skill text with the actual date, completion-oriented metrics, a crown-marked progress leader, compact named attention rows, and a quieter activity timeline. The result retains the source's content density while making every warning attributable and actionable.
- **Students:** reduced initials from oversized decorative circles to aligned 32px identifiers, removed the duplicate inner title, moved actions to the top-right, and allowed context and metrics to use the full row width.
- **Homework:** replaced large card-like rows and ambiguous `Live` language with compact divided rows, dedicated amber/emerald/neutral status colors, top-right actions, bottom-right student attribution, and wider summary copy. `Published` now names active links; the mixed view correctly uses `Assignments`.
- **History:** applied the Codex timeline idea as a lesson navigator plus one selected, vertically ordered lesson. Every step appears, including unanswered work, with independent scroll fades and contained overscroll.
- **Insights:** replaced the unreadable wall of nearly identical skill bars with capped Needs attention/Strong signals columns. Every skill includes named students, attempts, timing, and accuracy; Student performance follows immediately. EvilCharts remains for submission volume and no longer dominates sparse data.

### Final interaction verification

- New Homework resets the active builder instead of leaving stale notes/student state.
- Changing the selected student preserves Lesson Notes and does not remount the builder.
- Generation activity retains the complete semantic runtime/tool timeline with timestamps during generation, stays scrollable, and remains available in a collapsed disclosure after success. Consecutive streaming deltas are consolidated; raw hidden chain-of-thought is not exposed.
- Draft clearing opens a confirmation dialog and uses the bounded Convex deletion mutation; QA cancelled the dialog and did not delete user data.
- Homework copy-link feedback announces success/failure and resets after two seconds.
- Mira's in-progress history reports `5 of 8 answered`, aggregates saved telemetry to `36s active / 3 lookups`, and renders Q6–Q8 as `Not answered` / `Not graded` with no false `0/N` score.
- History lesson switching resets the detail viewport to the top; close removes the dialog and restores focus to the exact originating History button.
- Disconnected local Claude state is a `Connect Claude` link to the official CLI guide; installed but unauthenticated state opens the setup flow; ready state remains a quiet semantic status.
- Final browser console sweep initially exposed a Base UI anchor/button semantics warning in Preview. Both Homework and Draft Review links now set `nativeButton={false}`; a fresh navigation produced zero warnings/errors.

### Final findings and verification

No actionable P0, P1, or P2 findings remain in the verified states.

- `pnpm check` passed after the final accessibility patch.
- TypeScript passed for main, preload, renderer, web, and Convex code.
- Tests passed: 23 UI/unit + 18 Convex = 41.
- Electron production build passed.
- Web production build passed.
- Final in-app browser console: zero new warnings or errors.

## Shared homework player and feedback pass — August 10

### Source and implementation evidence

- Intro source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_YTHFp2/Screenshot 2026-08-10 at 10.49.17 PM.png` (`1404 × 1380`).
- Intro implementation: `/Users/sasakovaluk/projects/erm/.design-qa/player-intro-flat-1404x1380.png` (`1404 × 1380`).
- Matching source: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_8Tn8yV/Screenshot 2026-08-10 at 10.50.52 PM.png` (`1038 × 432`).
- Live matching implementation: `/Users/sasakovaluk/projects/erm/.design-qa/player-matching-live-1038x432.png` (`1038 × 432`).
- Three-pair color proof: `/Users/sasakovaluk/projects/erm/.design-qa/player-matching-colors-1038x432.png` (`1038 × 432`).
- Teacher preview proof: `/Users/sasakovaluk/projects/erm/.design-qa/teacher-preview-matching-1280x720-v2.png`; live pointer proof: `/Users/sasakovaluk/projects/erm/.design-qa/teacher-preview-matching-live-1280x720.png`.
- Student feedback proof: `/Users/sasakovaluk/projects/erm/.design-qa/player-feedback-1038x700.png`; teacher receipt: `/Users/sasakovaluk/projects/erm/.design-qa/teacher-feedback-1280x720.png`.
- Mobile feedback proof: `/Users/sasakovaluk/projects/erm/.design-qa/player-feedback-mobile-390x844.png`.

The intro and matching source/implementation pairs were each opened together in a single comparison input at identical output dimensions.

### Visible comparison conclusions

- The intro is no longer a large bordered card. It uses a centered reading column, typographic metadata, bullet objectives, border-only section rhythm, and a compact action.
- Questions share one centered, border-light stage in the public player and teacher preview. The header uses semantic dot/rail progress on the left and points on the right instead of a full progress bar.
- The teacher preview was widened and its question scale made container-appropriate at the 1280px workspace width; the activity, instructions, and first matching rows now appear together rather than forcing the task below the fold.
- Matching now uses a live organic connector that tracks the pointer across the column gap. Completed pairs retain distinct, evenly distributed colors; endpoints, dots, borders, halos, and paths use the same pair color.
- Rewrite activities keep the task separate from the source sentences and render the sentences as an ordered list.
- Completion feedback is a compact five-star form with an optional 500-character note. The exact rating and note appear in Today, Homework, and the teacher submission review.

### Interaction and recovery verification

- Selected Q1, reloaded the page, and verified the same checked answer plus enabled `Save & continue` were restored.
- Completed all eight activities through the live public flow. Completion restored after reload with the result, resume token, score, and answers intact.
- Selected a matching source and moved the pointer into the gap; `data-connecting` remained `true` and the colored organic path visibly followed the pointer. Connected three pairs and verified three distinct computed OKLCH colors and three persistent paths, then completed all five pairs.
- Repeated the unfinished live-connector interaction inside the teacher preview, confirming it uses the same widget and stage implementation.
- Submitted a 5/5 rating and note, reloaded, and verified the selected rating, comment, and saved state all restored.
- Opened the new teacher submission. Today showed `5/5 · feedback`; the review drawer showed the five stars and exact student comment.
- Mobile result measured `390px` viewport width and `390px` document width with no horizontal overflow.
- Fresh student and teacher tabs produced zero console warnings and zero console errors.

### Findings fixed during integration

1. **[P1] Completed player blanked before feedback rendered.** The live development deployment did not yet contain `feedback:getMine`, so Convex surfaced a missing-function error after submission. Confirmed the configured target as personal dev `impressive-mongoose-165`, synced only that deployment, reloaded the persisted result, and repeated rating/reload/teacher receipt successfully. Production was not touched.
2. **[P2] Teacher preview was technically shared but visually cramped at 1280px.** Its left column, gap, and 30px prompt left too little usable preview width. Rebalanced the grid and made the preview heading scale container-appropriate; the post-fix capture shows the matching interaction within the first viewport.

### Final verification

- `pnpm check` passes: TypeScript, 28 UI/unit tests, 23 Convex tests, Electron production build, and web production build.
- Configured personal Convex development functions are ready; no production deployment was executed.
- No actionable P0, P1, or P2 findings remain in the verified flow.

## Codex-style lesson history and warm query pass — August 10

### Source and implementation evidence

- Previous history dialog: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_tdJ8OE/Screenshot 2026-08-10 at 11.00.27 PM.png`.
- Codex outline preview reference: `/var/folders/x7/pxg8xqjd3hs6kyjfslgc_lgm0000gn/T/TemporaryItems/NSIRD_screencaptureui_Qf2TwM/Screenshot 2026-08-10 at 11.29.54 PM.png`.
- Final dialog: `/Users/sasakovaluk/projects/erm/.design-qa/history-redesign-dialog.png` (`1280 × 720`).
- Final hover/focus preview: `/Users/sasakovaluk/projects/erm/.design-qa/history-redesign-preview.png` (`1280 × 720`).

The previous dialog and final dialog were opened together in one visual comparison input. The Codex outline reference and final floating preview were also opened together in that comparison pass.

### Visible comparison conclusions

- The permanent 280px lesson-card sidebar is replaced by a quiet 72px outline rail with 44px controls, short status ticks, and a longer selected tick. Repeated lesson borders and the heavy green selected outline are gone.
- Hovering or focusing a tick opens a light 300px preview containing the title, a clamped summary, status, relative time, and the jump action. Its hairline, radius, spacing, and restrained shadow match the supplied Codex outline reference.
- The selected lesson is now one centered reading column. Every question uses the same `PromptContent`, instructions, and read-only `QuestionWidget` as the student lesson, populated from the canonical public question content and raw typed answer response.
- Submitted answers are no longer wrapped in bespoke nested cards. The only remaining control borders are the actual lesson inputs and options, which intentionally match the student-facing task.
- A mobile lesson picker replaces the hover-only rail below the desktop split layout.

### Cache and interaction verification

- Convex server-side query caching was already active; the visible reload came from unmounting the final client subscriber. The last-opened history workspace now remains mounted while closed.
- History is prewarmed on pointer enter, focus, pointer down, and open. Lesson detail is prewarmed on rail hover/focus/pointer down and kept reactively subscribed for five minutes.
- The first submission ID is derived during render, removing the history-to-detail effect waterfall.
- Hovered a lesson, selected it, and observed zero `Loading lesson…` nodes on the jump.
- Closed history, verified focus returned to Mira's exact History control, reopened immediately, and observed zero `Loading lessons…` and zero `Loading lesson…` nodes.
- Every saved question rendered in order with its exact selected choice, blank values, matching assignments, or written answer. Unanswered questions retain `Not answered` / `Not graded` semantics.
- Final browser console: zero warnings and zero errors. Document and body width both measured `1280px` for a `1280px` viewport, with no horizontal overflow.

### Verification

- `pnpm typecheck` passed.
- Tests passed: 30 renderer/unit + 23 Convex.
- Electron production build passed.
- Web production build passed.
- Updated teacher-detail contract was synced only to personal development deployment `impressive-mongoose-165`; production was not touched.

No actionable P0, P1, or P2 findings remain in the verified history flow.

final result: passed
