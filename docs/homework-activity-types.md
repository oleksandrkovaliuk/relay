# Homework activity types

The teacher picks which activity types a set may contain (`ActivityTypePicker` in
`src/homework/builder/`), and that selection is threaded through
`generateHomeworkInputSchema.activityTypes` into the Claude prompt. This document
records what exists today and what is worth building next.

Every activity type touches five places, so adding one is a vertical slice of its
own rather than a UI change:

1. `convex/content.ts` — `questionContentValidator`, `publicQuestionContentValidator`,
   `answerResponseValidator`, `toPublicContent`, `describeCorrectAnswer`, and the grader.
2. `src/shared/claude.ts` — the zod mirror the generator is constrained by, plus `ACTIVITY_TYPES`.
3. `src/main/claude/prompt.ts` — the `content` contract Claude must satisfy.
4. `src/homework/player/answer-types.ts` — `emptyResponse` and `isAnswerComplete`.
5. `src/homework/player/question-widgets.tsx` — the widget, which must also render read-only
   for the teacher's answer key and the lesson transcript.

## Shipping today

| Type              | Student action                       | Grading            |
| ----------------- | ------------------------------------ | ------------------ |
| `multiple_choice` | Pick one of 2–6 options              | Automatic          |
| `fill_blank`      | Type into `{{n}}` gaps in a sentence | Automatic, variants |
| `matching`        | Click a prompt, then its match       | Automatic, partial |
| `short_answer`    | Write a sentence or two              | Teacher            |
| `rewrite`         | Correct or transform given sentences | Teacher            |

## Proposed next — ranked

Ranking is by teaching value per unit of build cost for one-to-one English
tutoring, which is what this app is for.

### 1. `order_words` — sentence builder (recommended first)

Drag or click word tiles into the correct order. This is the single most
requested activity in language apps because it isolates syntax from vocabulary
and spelling, and it is the cheapest of these to build: one array in, one array
out, exact-match grading with an optional set of accepted orderings.

- **Content**: `{ kind: "order_words", tokens: string[], acceptedOrders: number[][] }`
- **Response**: `{ kind: "order", tokenOrder: number[] }`
- **Grading**: automatic; partial credit from the longest common subsequence against the
  nearest accepted order, which rewards a mostly-right sentence.
- **Player**: tap-to-append plus tap-to-remove is enough and works on touch; drag is a later polish.
- **Why**: directly targets word-order errors, the most common L1 interference for Slavic
  and East-Asian learners. Auto-graded, so it costs the teacher nothing.

### 2. `categorise` — sort items into buckets

Drop each item under one of 2–4 headings: *past simple* vs *present perfect*,
*countable* vs *uncountable*, *for* vs *since*.

- **Content**: `{ kind: "categorise", buckets: string[], items: { text: string, bucketIndex: number }[] }`
- **Response**: `{ kind: "buckets", bucketIndexByItem: number[] }`
- **Grading**: automatic, per-item partial credit.
- **Player**: reuses the matching widget's interaction model (select an item, click a bucket),
  so the connector geometry and pair-colour system carry over.
- **Why**: teaches the *rule* behind a contrast rather than one instance of it, and the
  per-item scoring produces genuinely useful skill telemetry.

### 3. `error_hunt` — find the mistake in a sentence

The student clicks the wrong word, then types the correction.

- **Content**: `{ kind: "error_hunt", tokens: string[], errorIndex: number, acceptedCorrections: string[] }`
- **Response**: `{ kind: "error_hunt", selectedIndex: number, correction: string }`
- **Grading**: automatic; half credit for finding it, half for fixing it.
- **Why**: proof-reading is a distinct skill from production, and this is the closest
  auto-gradable proxy for what a teacher does in a lesson. It also pairs perfectly with the
  recurring-error context already stored per student.

### 4. `audio_dictation` — listen and type

- **Content**: `{ kind: "audio_dictation", audioStorageId: Id<"_storage">, acceptedAnswers: string[] }`
- **Grading**: automatic with the existing `normalizeText`.
- **Cost**: higher — needs Convex file storage, an upload path, and a TTS or teacher-recorded
  source. Text-to-speech in the browser (`SpeechSynthesis`) removes the storage cost entirely
  and is worth trying first.
- **Why**: listening is the biggest gap in a text-only homework tool. Also the biggest build.

### 5. `dialogue_response` — reply in a conversation

A short scripted exchange where the student supplies one turn.

- **Content**: `{ kind: "dialogue_response", turns: { speaker: string, text: string }[], studentTurnIndex: number, expectedAnswer?: string }`
- **Grading**: teacher, like `short_answer`.
- **Why**: cheap to build (it is `short_answer` with context rendering) and much better at
  eliciting natural language than a bare prompt. Good low-cost win.

## Deliberately not proposed

- **Crosswords and word searches** — high build cost, low teaching value per minute; they
  test spelling recall rather than production.
- **Free-form drawing or whiteboard** — the Miro board already covers this, and it is
  ungradable.
- **Timed drills** — the app measures engaged time precisely and uses it as *evidence*.
  Turning time into pressure would corrupt that signal.

## Suggested build order

`order_words` → `categorise` → `error_hunt`, then reassess. Those three are all
auto-graded, share the existing interaction vocabulary, and need no new
infrastructure. `dialogue_response` can be slotted in at any point as it is
nearly free. Leave `audio_dictation` until there is a reason to take on storage.
