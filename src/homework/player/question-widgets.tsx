import { Check } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { MatchingWidget } from "./matching-widget";
import { splitBlankText, type AnswerResponse, type PublicQuestionContent } from "./answer-types";

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];
const OPEN_RESPONSE_MINIMUM_HEIGHT = 168;
const OPEN_RESPONSE_MAXIMUM_HEIGHT = 320;
const BLANK_MINIMUM_WIDTH_CH = 6;
/** A blank holds a word or two; past this the answer scrolls inside the gap
 *  rather than stretching the sentence out of shape. */
const BLANK_MAXIMUM_WIDTH_CH = 18;

type WidgetProps = {
  content: PublicQuestionContent;
  response: AnswerResponse;
  onChange: (response: AnswerResponse) => void;
  isReadOnly?: boolean;
};

export function QuestionWidget({ content, response, onChange, isReadOnly }: WidgetProps) {
  if (content.kind === "multiple_choice" && response.kind === "choice") {
    return (
      <MultipleChoiceWidget
        choices={content.choices}
        choiceIndex={response.choiceIndex}
        onSelect={(choiceIndex) => onChange({ kind: "choice", choiceIndex })}
        isReadOnly={isReadOnly}
      />
    );
  }
  if (content.kind === "fill_blank" && response.kind === "blanks") {
    return (
      <FillBlankWidget
        text={content.text}
        values={response.values}
        onChange={(values) => onChange({ kind: "blanks", values })}
        isReadOnly={isReadOnly}
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

function MultipleChoiceWidget({
  choices,
  choiceIndex,
  onSelect,
  isReadOnly,
}: {
  choices: string[];
  choiceIndex: number;
  onSelect: (choiceIndex: number) => void;
  isReadOnly?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-2.5">
      {choices.map((choice, index) => {
        const isSelected = index === choiceIndex;
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
              isSelected
                ? "border-primary bg-primary-soft font-medium text-primary"
                : "border-border bg-card text-ink hover:border-input hover:bg-muted/45",
              isReadOnly && "cursor-default",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-[11px] font-semibold",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-ink-secondary",
              )}
            >
              {isSelected ? (
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
  values,
  onChange,
  isReadOnly,
}: {
  text: string;
  values: string[];
  onChange: (values: string[]) => void;
  isReadOnly?: boolean;
}) {
  const segments = splitBlankText(text);
  const hasMarkers = segments.some((segment) => segment.blankIndex !== null);

  function updateBlank(blankIndex: number, value: string) {
    onChange(values.map((current, index) => (index === blankIndex ? value : current)));
  }

  if (!hasMarkers) {
    return (
      <div className="grid gap-3.5">
        <p className="text-base leading-8 text-ink lg:text-[17px]">{text}</p>
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <span className="w-5 text-[13px] text-ink-secondary numeric">{index + 1}.</span>
            <input
              value={value}
              disabled={isReadOnly}
              aria-label={`Blank ${index + 1}`}
              onChange={(event) => updateBlank(index, event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 lg:text-base"
              placeholder="Your answer"
            />
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
          <BlankInput
            key={index}
            index={segment.blankIndex}
            value={values[segment.blankIndex] ?? ""}
            onChange={(value) => updateBlank(segment.blankIndex ?? 0, value)}
            isReadOnly={isReadOnly}
          />
        ),
      )}
    </p>
  );
}

function BlankInput({
  index,
  value,
  onChange,
  isReadOnly,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
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
        value.trim() ? "border-primary text-primary" : "border-input text-ink hover:border-ink-muted",
      )}
    />
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

  useLayoutEffect(function growTextareaToFitAnswer() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(
      OPEN_RESPONSE_MAXIMUM_HEIGHT,
      Math.max(OPEN_RESPONSE_MINIMUM_HEIGHT, textarea.scrollHeight),
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > OPEN_RESPONSE_MAXIMUM_HEIGHT ? "auto" : "hidden";
  }, [text]);

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
