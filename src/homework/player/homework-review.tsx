import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Check, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { groupQuestionsIntoSets, type PublicQuestionContent } from "./answer-types";
import { PromptContent } from "./prompt-content";
import { ReferenceRules } from "./reference-rules";

type ReviewData = NonNullable<FunctionReturnType<typeof api.submissions.review>>;
type ReviewItem = ReviewData["items"][number];
type Verdict = "correct" | "partial" | "incorrect" | "pending" | "skipped";

const VERDICT_LABELS: Record<Verdict, string> = {
  correct: "correct",
  partial: "partly right",
  incorrect: "not yet",
  pending: "your teacher will read this",
  skipped: "left blank",
};

/** Left edge and verdict colour, the way a marked worksheet is colour-coded. */
const VERDICT_STYLES: Record<Verdict, { edge: string; text: string; surface: string }> = {
  correct: { edge: "border-l-primary", text: "text-primary", surface: "bg-primary-soft/35" },
  partial: { edge: "border-l-amber-500", text: "text-amber-700", surface: "bg-amber-50/60" },
  incorrect: {
    edge: "border-l-destructive",
    text: "text-destructive",
    surface: "bg-critical-soft/45",
  },
  pending: { edge: "border-l-input", text: "text-ink-secondary", surface: "bg-muted/35" },
  skipped: { edge: "border-l-input", text: "text-ink-muted", surface: "bg-muted/25" },
};

/**
 * The marked worksheet. Every activity keeps the shape it had while answering,
 * with the student's own answer, the expected one, and the reason it went the way
 * it did — which is the part a score alone can never teach.
 */
export function HomeworkReview({ review }: { review: ReviewData }) {
  const sets = groupQuestionsIntoSets(review.items);

  return (
    <div className="grid gap-8">
      {review.referenceRules.length > 0 ? (
        <ReferenceRules rules={review.referenceRules} />
      ) : null}

      {sets.map((set, setIndex) => (
        <section key={`${set.title}-${setIndex}`} className="grid gap-3">
          <SetHeading
            index={setIndex}
            title={set.title || "Your answers"}
            task={set.task}
            score={describeSetScore(set.questions)}
          />
          <div className="grid gap-2.5">
            {set.questions.map((item) => (
              <ReviewRow key={item.questionId} item={item} step={review.items.indexOf(item) + 1} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SetHeading({
  index,
  title,
  task,
  score,
}: {
  index: number;
  title: string;
  task: string;
  score: string;
}) {
  return (
    <div className="border-t-2 border-ink pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-destructive">
          Set {index + 1}
        </p>
        <p className="font-mono text-[12px] text-ink-secondary numeric">{score}</p>
      </div>
      <h2 className="mt-0.5 text-balance text-[21px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[24px]">
        {title}
      </h2>
      {task ? (
        <p className="mt-1 max-w-[60ch] text-pretty text-[14px] leading-6 text-ink-secondary">
          {task}
        </p>
      ) : null}
    </div>
  );
}

function ReviewRow({ item, step }: { item: ReviewItem; step: number }) {
  const verdict = resolveVerdict(item);
  const styles = VERDICT_STYLES[verdict];
  const [isOpen, setIsOpen] = useState(verdict === "incorrect" || verdict === "partial");
  const hasDetail = Boolean(item.explanation) || item.parts.length > 0 || item.timeline.length > 0;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border border-l-[3px] bg-card",
        styles.edge,
        styles.surface,
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 w-5 shrink-0 font-mono text-[12px] text-ink-secondary numeric">
          {step}.
        </span>
        <div className="min-w-0 flex-1">
          <PromptContent prompt={readableTaskText(item)} size="sm" />
          <div className="mt-2.5 grid gap-1.5">
            <AnswerLine
              label="You wrote"
              value={item.answered ? item.yourAnswer || "—" : "nothing"}
              tone={verdict === "incorrect" || verdict === "partial" ? "given" : "neutral"}
            />
            {verdict === "correct" || verdict === "pending" ? null : (
              <AnswerLine label="Expected" value={item.correctAnswer ?? "—"} tone="expected" />
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "font-mono text-[10.5px] uppercase tracking-[0.12em]",
              styles.text,
            )}
          >
            {VERDICT_LABELS[verdict]}
          </span>
          <span className="font-mono text-[11px] text-ink-muted numeric">
            {item.pointsAwarded}/{item.points}
          </span>
        </div>
      </div>

      {hasDetail ? (
        <div className="border-t border-dotted border-border px-4 py-3">
          {item.parts.length > 0 ? <PartBreakdown parts={item.parts} /> : null}
          {item.explanation ? (
            <p className="mt-2 text-pretty text-[13.5px] leading-6 text-ink-secondary first:mt-0">
              {item.explanation}
            </p>
          ) : null}
          {item.timeline.length > 0 ? (
            <TimelineStrip beats={item.timeline} isOpen={isOpen} onToggle={setIsOpen} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * The sentence as a person would read it. Generated prompts carry `{{1}}` gap
 * markers meant for the widget, which are noise once the activity is marked.
 */
function readableTaskText(item: ReviewItem) {
  const sentence =
    item.content.kind === "error_fix"
      ? `${item.content.before}${item.content.flagged}${item.content.after}`
      : item.prompt;
  return sentence.replaceAll(/\{\{\d+\}\}/g, "____");
}

function AnswerLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "given" | "expected" | "correct" | "neutral";
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 font-mono text-[13.5px]",
          tone === "given" && "text-destructive",
          tone === "neutral" && "text-ink",
          (tone === "correct" || tone === "expected") && "text-primary",
        )}
      >
        {value}
      </span>
    </p>
  );
}

/** Per-gap marking, so a partly right activity shows which part failed. */
function PartBreakdown({ parts }: { parts: ReviewItem["parts"] }) {
  return (
    <ul className="grid gap-1">
      {parts.map((part, index) => (
        <li key={`${part.label}-${index}`} className="flex items-start gap-2 text-[13px] leading-5">
          <span
            className={cn(
              "mt-0.5 shrink-0",
              part.isCorrect ? "text-primary" : "text-destructive",
            )}
          >
            {part.isCorrect ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
              {part.label}
            </span>{" "}
            <span className="font-mono text-ink">{part.given || "—"}</span>
            {part.isCorrect ? null : (
              <>
                {" → "}
                <span className="font-mono text-primary">{part.expected}</span>
              </>
            )}
            {part.reason ? (
              <span className="mt-0.5 block text-[12.5px] leading-5 text-ink-secondary">
                {part.reason}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The order strip: which event was older. For a tense mistake this explains more
 * than any wording can.
 */
function TimelineStrip({
  beats,
  isOpen,
  onToggle,
}: {
  beats: string[];
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}) {
  return (
    <div className="mt-2.5">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => onToggle(!isOpen)}
        className="min-h-8 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted underline-offset-4 hover:underline"
      >
        {isOpen ? "Hide the order" : "What happened first?"}
      </button>
      {isOpen ? (
        <ol className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 font-mono text-[12px]">
          {beats.map((beat, index) => (
            <li key={beat} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ArrowRight size={12} className="text-amber-600" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5",
                  index === 0
                    ? "border-dashed border-border bg-card text-ink-secondary"
                    : "border-border bg-muted text-ink",
                )}
              >
                {index + 1} · {beat}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function resolveVerdict(item: ReviewItem): Verdict {
  if (!item.answered) return "skipped";
  if (item.correctness === "pending_review" || item.correctness === undefined) return "pending";
  if (item.correctness === "correct") return "correct";
  if (item.correctness === "partial") return "partial";
  return "incorrect";
}

function describeSetScore(items: ReviewItem[]) {
  const gradable = items.filter((item) => item.correctness !== "pending_review");
  if (gradable.length === 0) return "for your teacher to read";
  const awarded = gradable.reduce((total, item) => total + item.pointsAwarded, 0);
  const available = gradable.reduce((total, item) => total + item.points, 0);
  return `${awarded} / ${available}`;
}

/**
 * The sticky total, with a line that changes what it tells the student to do
 * next depending on how the set actually went.
 */
export function ReviewTotal({
  percentage,
  score,
  maxAutoScore,
  pendingReviewCount,
  action,
}: {
  percentage: number;
  score: number;
  maxAutoScore: number;
  pendingReviewCount: number;
  action?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 rounded-xl bg-ink px-4 py-3.5 text-background">
      <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] numeric">
        {score} / {maxAutoScore}
      </p>
      <p className="min-w-0 flex-1 font-mono text-[12px] leading-5 opacity-80">
        {describeTotal(percentage)}
        {pendingReviewCount > 0
          ? ` ${pendingReviewCount} written ${pendingReviewCount === 1 ? "answer" : "answers"} still to be read by your teacher.`
          : ""}
      </p>
      {action}
    </div>
  );
}

function describeTotal(percentage: number) {
  if (percentage >= 90) return "Bring the notes you disagree with to class.";
  if (percentage >= 70) return "Look at every red one and say out loud what the right form does.";
  return "Open the cheat sheet at the top, then read the red notes one by one.";
}

/** Renders a widget read-only, for reviewing what was answered. */
export type ReviewWidgetContent = PublicQuestionContent;
