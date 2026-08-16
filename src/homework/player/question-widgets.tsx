import { Check, ChevronDown, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { MatchingWidget } from "./matching-widget";
import {
  splitBlankText,
  UNSELECTED_OPTION,
  type AnswerResponse,
  type PublicQuestionContent,
  type WidgetMarking,
} from "./answer-types";

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];
const OPEN_RESPONSE_MINIMUM_HEIGHT = 168;
const OPEN_RESPONSE_MAXIMUM_HEIGHT = 320;
const BLANK_MINIMUM_WIDTH_CH = 6;
/** A blank holds a word or two; past this the answer scrolls inside the gap
 *  rather than stretching the sentence out of shape. */
const BLANK_MAXIMUM_WIDTH_CH = 18;
const GAP_PLACEHOLDER = "choose…";
const ERROR_FIX_PLACEHOLDER = "fixed phrase";
/** Room for the chevron sitting inside the gap's right edge. */
const GAP_CHEVRON_WIDTH_CH = 2.5;

type WidgetProps = {
  content: PublicQuestionContent;
  response: AnswerResponse;
  onChange: (response: AnswerResponse) => void;
  isReadOnly?: boolean;
  /** Present only in review: marks each part of the student's own attempt. */
  marking?: WidgetMarking;
};

export function QuestionWidget({
  content,
  response,
  onChange,
  isReadOnly,
  marking,
}: WidgetProps) {
  if (content.kind === "multiple_choice" && response.kind === "choice") {
    return (
      <MultipleChoiceWidget
        choices={content.choices}
        choiceIndex={response.choiceIndex}
        onSelect={(choiceIndex) => onChange({ kind: "choice", choiceIndex })}
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (content.kind === "fill_blank" && response.kind === "blanks") {
    return (
      <FillBlankWidget
        text={content.text}
        hints={content.hints}
        values={response.values}
        onChange={(values) => onChange({ kind: "blanks", values })}
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (content.kind === "select_cloze" && response.kind === "selections") {
    return (
      <SelectClozeWidget
        text={content.text}
        gaps={content.gaps}
        selectedOptions={response.selectedOptions}
        onChange={(selectedOptions) =>
          onChange({ kind: "selections", selectedOptions })
        }
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (content.kind === "matching" && response.kind === "matches") {
    return (
      <MatchingWidget
        lefts={content.lefts}
        rights={content.rights}
        assigned={response.rights}
        onChange={(rights) => onChange({ kind: "matches", rights })}
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (content.kind === "error_fix" && response.kind === "text") {
    return (
      <ErrorFixWidget
        before={content.before}
        flagged={content.flagged}
        after={content.after}
        text={response.text}
        onChange={(text) => onChange({ kind: "text", text })}
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (content.kind === "proofread" && response.kind === "blanks") {
    return (
      <ProofreadWidget
        text={content.text}
        errors={content.errors}
        values={response.values}
        onChange={(values) => onChange({ kind: "blanks", values })}
        isReadOnly={isReadOnly}
        marking={marking}
      />
    );
  }
  if (response.kind === "text") {
    return (
      <OpenResponseWidget
        text={response.text}
        onChange={(text) => onChange({ kind: "text", text })}
        isReadOnly={isReadOnly}
      />
    );
  }
  return null;
}

/**
 * The sentence stands as written, with the broken phrase struck through in place —
 * the student can see the mistake and has to produce only the repair.
 */
function ErrorFixWidget({
  before,
  flagged,
  after,
  text,
  onChange,
  isReadOnly,
  marking,
}: {
  before: string;
  flagged: string;
  after: string;
  text: string;
  onChange: (text: string) => void;
  isReadOnly?: boolean;
  marking?: WidgetMarking;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-base leading-8 text-ink lg:text-[17px]">
        {before}
        <FlaggedPhrase>{flagged}</FlaggedPhrase>
        {after}
      </p>
      <label className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-secondary">
          The fixed phrase only
        </span>
        <input
          value={text}
          disabled={isReadOnly}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={ERROR_FIX_PLACEHOLDER}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-11 w-full max-w-sm rounded-xl border bg-card px-3 font-mono text-[15px] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25",
            marking
              ? cn("border-border", singleMark(marking)?.isCorrect ? "text-primary" : "text-destructive")
              : text.trim()
                ? "border-primary text-ink"
                : "border-border text-ink",
          )}
        />
        <ExpectedInline mark={singleMark(marking)} />
      </label>
    </div>
  );
}

/**
 * A passage the student proofreads. Every mistake stays where it was written,
 * struck through, with the correction typed straight after it — so the fix is
 * read in the sentence it belongs to rather than in a list of loose answers.
 */
function ProofreadWidget({
  text,
  errors,
  values,
  onChange,
  isReadOnly,
  marking,
}: {
  text: string;
  errors: { flagged: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  isReadOnly?: boolean;
  marking?: WidgetMarking;
}) {
  const segments = splitBlankText(text);

  function updateCorrection(errorIndex: number, value: string) {
    onChange(values.map((current, index) => (index === errorIndex ? value : current)));
  }

  return (
    <div className="grid gap-4">
      <p className="text-base leading-[2.6] text-ink lg:text-[17px]">
        {segments.map((segment, index) => {
          if (segment.blankIndex === null) return <span key={index}>{segment.text}</span>;
          const errorIndex = segment.blankIndex;
          const flagged = errors[errorIndex]?.flagged;
          if (!flagged) return null;
          return (
            <span key={index} className="whitespace-nowrap">
              <FlaggedPhrase isStruckThrough>{flagged}</FlaggedPhrase>
              <BlankInput
                index={errorIndex}
                value={values[errorIndex] ?? ""}
                onChange={(value) => updateCorrection(errorIndex, value)}
                isReadOnly={isReadOnly}
                mark={marking?.parts[errorIndex]}
              />
              <ExpectedInline mark={marking?.parts[errorIndex]} />
            </span>
          );
        })}
      </p>
      {marking ? null : (
        // The count, not a restatement of the task: the instructions above
        // already say what to do, and a passage makes it easy to miss one.
        <p className="text-[12.5px] text-ink-secondary numeric">
          {errors.length} {errors.length === 1 ? "mistake" : "mistakes"} to fix.
        </p>
      )}
    </div>
  );
}

/** The wrong phrase, marked the way a teacher's pen would mark it. */
export function FlaggedPhrase({
  children,
  isStruckThrough,
}: {
  children: string;
  /** Struck through when the correction is typed beside it, not in place of it. */
  isStruckThrough?: boolean;
}) {
  return (
    <span
      className={cn(
        "mx-0.5 whitespace-nowrap rounded-[3px] px-1 font-mono text-[0.94em] text-destructive",
        isStruckThrough
          ? "bg-critical-soft/70 line-through decoration-destructive/70"
          : "border-b-2 border-destructive bg-critical-soft",
      )}
    >
      {children}
    </span>
  );
}

function MultipleChoiceWidget({
  choices,
  choiceIndex,
  onSelect,
  isReadOnly,
  marking,
}: {
  choices: string[];
  choiceIndex: number;
  onSelect: (choiceIndex: number) => void;
  isReadOnly?: boolean;
  marking?: WidgetMarking;
}) {
  return (
    <div role="radiogroup" className="grid gap-2.5">
      {choices.map((choice, index) => {
        const isSelected = index === choiceIndex;
        const isExpected = marking ? index === marking.correctChoiceIndex : false;
        const isWrongPick = Boolean(marking) && isSelected && !isExpected;
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isReadOnly}
            onClick={() => onSelect(index)}
            className={cn(
              "flex min-h-[3.25rem] w-full items-start gap-3.5 rounded-xl border px-3.5 py-3 text-left text-[15px] leading-6 transition-[background-color,border-color,color,transform] duration-[120ms] ease-[var(--ease-out)] active:scale-[.99] motion-reduce:active:scale-100 lg:text-base",
              isSelected && !marking
                ? "border-primary bg-primary-soft font-medium text-primary"
                : "border-border bg-card text-ink hover:border-input hover:bg-muted/45",
              isWrongPick && "font-medium text-destructive",
              isExpected && "font-medium text-primary",
              isReadOnly && "cursor-default",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-[11px] font-semibold leading-none",
                isWrongPick && "border-destructive/50 text-destructive",
                !isWrongPick && (isExpected || (isSelected && !marking))
                  ? "border-primary bg-primary text-primary-foreground"
                  : isWrongPick
                    ? ""
                    : "border-input text-ink-secondary",
              )}
            >
              {isWrongPick ? (
                <X size={12} strokeWidth={3} aria-hidden />
              ) : isExpected || (isSelected && !marking) ? (
                <Check size={12} strokeWidth={3} aria-hidden />
              ) : (
                (CHOICE_LETTERS[index] ?? String(index + 1))
              )}
            </span>
            <span className="min-w-0 flex-1">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function FillBlankWidget({
  text,
  hints,
  values,
  onChange,
  isReadOnly,
  marking,
}: {
  text: string;
  hints: (string | null)[];
  values: string[];
  onChange: (values: string[]) => void;
  isReadOnly?: boolean;
  marking?: WidgetMarking;
}) {
  const segments = splitBlankText(text);
  const hasMarkers = segments.some((segment) => segment.blankIndex !== null);

  function updateBlank(blankIndex: number, value: string) {
    onChange(
      values.map((current, index) => (index === blankIndex ? value : current)),
    );
  }

  if (!hasMarkers) {
    return (
      <div className="grid gap-3.5">
        <p className="text-base leading-8 text-ink lg:text-[17px]">{text}</p>
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <span className="w-5 text-[13px] text-ink-secondary numeric">
              {index + 1}.
            </span>
            <input
              value={value}
              disabled={isReadOnly}
              aria-label={`Blank ${index + 1}`}
              onChange={(event) => updateBlank(index, event.target.value)}
              className={cn(
                "h-11 min-w-0 flex-1 rounded-xl border bg-card px-3 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 lg:text-base",
                marking
                  ? cn(
                      "border-border",
                      marking.parts[index]?.isCorrect ? "text-primary" : "text-destructive",
                    )
                  : "border-border text-ink",
              )}
              placeholder="Your answer"
            />
            <HintWord hint={hints[index] ?? null} />
            <ExpectedInline mark={marking?.parts[index]} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-base leading-[2.4] text-ink lg:text-[17px]">
      {segments.map((segment, index) =>
        segment.blankIndex === null ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index} className="whitespace-nowrap">
            <BlankInput
              index={segment.blankIndex}
              value={values[segment.blankIndex] ?? ""}
              onChange={(value) => updateBlank(segment.blankIndex ?? 0, value)}
              isReadOnly={isReadOnly}
              mark={marking?.parts[segment.blankIndex]}
            />
            <HintWord hint={hints[segment.blankIndex] ?? null} />
            <ExpectedInline mark={marking?.parts[segment.blankIndex]} />
          </span>
        ),
      )}
    </p>
  );
}

/** What the answer should have been, beside the part that got it wrong. */
function ExpectedInline({ mark }: { mark?: { isCorrect: boolean; expected: string } }) {
  if (!mark || mark.isCorrect || !mark.expected) return null;
  return (
    <span className="mx-1 whitespace-nowrap font-mono text-[0.86em] text-primary">
      → {mark.expected}
    </span>
  );
}

/** error_fix and open_response have one answer, so one verdict. */
function singleMark(marking?: WidgetMarking) {
  if (!marking) return undefined;
  return { isCorrect: marking.parts[0]?.isCorrect ?? false, expected: marking.expected ?? "" };
}

/**
 * The dictionary form the student must reshape. Set apart in the accent colour
 * so it reads as a given, not as part of the sentence.
 */
function HintWord({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return <span className="text-[0.86em] font-bold text-primary">({hint})</span>;
}

function BlankInput({
  index,
  value,
  onChange,
  isReadOnly,
  mark,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
  mark?: { isCorrect: boolean; expected: string };
}) {
  const measuredWidth = Math.min(
    BLANK_MAXIMUM_WIDTH_CH,
    Math.max(BLANK_MINIMUM_WIDTH_CH, value.length + 1),
  );
  return (
    <input
      value={value}
      disabled={isReadOnly}
      aria-label={`Blank ${index + 1}`}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => onChange(event.target.value)}
      style={{ width: `${measuredWidth}ch` }}
      className={cn(
        "mx-1 rounded-none border-0 border-b-2 bg-transparent px-1 pb-0.5 text-center align-baseline text-[15px] font-medium outline-none transition-colors duration-150 focus-visible:border-primary lg:text-base",
        mark
          ? mark.isCorrect
            ? "border-primary text-primary"
            : "border-destructive text-destructive"
          : value.trim()
            ? "border-primary text-primary"
            : "border-input text-ink hover:border-ink-muted",
      )}
    />
  );
}

/**
 * A whole passage the student reads, choosing the right form at every gap. The
 * gaps are native selects so keyboard and touch both work, styled to sit inside
 * prose rather than look like a form field.
 */
function SelectClozeWidget({
  text,
  gaps,
  selectedOptions,
  onChange,
  isReadOnly,
  marking,
}: {
  text: string;
  gaps: { options: string[] }[];
  selectedOptions: number[];
  onChange: (selectedOptions: number[]) => void;
  isReadOnly?: boolean;
  marking?: WidgetMarking;
}) {
  const segments = splitBlankText(text);

  function selectOption(gapIndex: number, option: number) {
    onChange(
      selectedOptions.map((current, index) =>
        index === gapIndex ? option : current,
      ),
    );
  }

  return (
    <p className="text-base leading-[2.5] text-ink lg:text-[17px]">
      {segments.map((segment, index) => {
        if (segment.blankIndex === null)
          return <span key={index}>{segment.text}</span>;
        const gapIndex = segment.blankIndex;
        const gap = gaps[gapIndex];
        if (!gap) return null;
        const selected = selectedOptions[gapIndex] ?? UNSELECTED_OPTION;
        // The gap must fit its longest option *and* the placeholder, or the
        // unanswered state renders clipped.
        const widestLabel = [GAP_PLACEHOLDER, ...gap.options].reduce(
          (widest, label) => Math.max(widest, label.length),
          0,
        );
        return (
          <span
            key={index}
            className="relative mx-1 inline-block whitespace-nowrap align-baseline"
          >
            <select
              aria-label={`Gap ${gapIndex + 1}`}
              disabled={isReadOnly}
              value={selected}
              onChange={(event) =>
                selectOption(gapIndex, Number(event.target.value))
              }
              style={{ width: `${widestLabel + GAP_CHEVRON_WIDTH_CH}ch` }}
              className={cn(
                "appearance-none rounded-none border-0 border-b-2 bg-transparent bg-none pb-0.5 pl-1 pr-5 text-center align-baseline text-[15px] font-medium outline-none transition-colors duration-150 focus-visible:border-primary disabled:cursor-default lg:text-base",
                marking
                  ? marking.parts[gapIndex]?.isCorrect
                    ? "border-input text-primary"
                    : "border-destructive text-destructive"
                  : selected >= 0
                    ? "border-primary text-primary"
                    : "border-input text-ink-muted hover:border-ink-muted",
              )}
            >
              <option value={UNSELECTED_OPTION} disabled>
                {GAP_PLACEHOLDER}
              </option>
              {gap.options.map((option, optionIndex) => (
                <option key={option} value={optionIndex}>
                  {option}
                </option>
              ))}
            </select>
            {marking ? null : (
              <ChevronDown
                size={13}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute right-1 bottom-[0.35em]",
                  selected >= 0 ? "text-primary" : "text-ink-muted",
                )}
              />
            )}
            <ExpectedInline mark={marking?.parts[gapIndex]} />
          </span>
        );
      })}
    </p>
  );
}

function OpenResponseWidget({
  text,
  onChange,
  isReadOnly,
}: {
  text: string;
  onChange: (text: string) => void;
  isReadOnly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  useLayoutEffect(
    function growTextareaToFitAnswer() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const nextHeight = Math.min(
        OPEN_RESPONSE_MAXIMUM_HEIGHT,
        Math.max(OPEN_RESPONSE_MINIMUM_HEIGHT, textarea.scrollHeight),
      );
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY =
        textarea.scrollHeight > OPEN_RESPONSE_MAXIMUM_HEIGHT
          ? "auto"
          : "hidden";
    },
    [text],
  );

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={text}
        disabled={isReadOnly}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer…"
        className="w-full resize-none rounded-xl border border-border bg-card p-3.5 text-[15px] leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 lg:text-base"
      />
      <p className="mt-2 text-right text-[13px] text-ink-secondary numeric">
        {wordCount} {wordCount === 1 ? "word" : "words"}
      </p>
    </div>
  );
}
