import { cn } from "@/lib/utils";

const NUMBERED_ITEM_PATTERN = /(?:^|\s)(\d{1,2})[.)]\s+/g;
const LETTERED_ITEM_PATTERN = /(?:^|\s)\(([a-h])\)\s+/g;
const MINIMUM_ITEMS = 2;
const MAXIMUM_ITEMS = 20;
/** Past this, a prompt set in the display size becomes a wall of bold text. */
const LONG_PROMPT_LENGTH = 120;

type PromptSize = "lg" | "md" | "sm";

type ParsedPrompt = {
  instruction: string;
  items: string[];
  /** Preserved so the rendered list keeps the markers the prompt referred to. */
  marker: "number" | "letter";
};

const HEADING_CLASSES: Record<PromptSize, { standard: string; long: string }> = {
  lg: {
    standard: "text-[22px] leading-snug sm:text-[26px] lg:text-[28px]",
    long: "text-[18px] leading-[1.35] sm:text-[20px] lg:text-[21px]",
  },
  md: {
    standard: "text-[21px] leading-snug sm:text-[23px] 2xl:text-[26px]",
    long: "text-[17px] leading-[1.35] sm:text-[18.5px] 2xl:text-[20px]",
  },
  sm: {
    standard: "text-[16px] leading-6 sm:text-[17px] sm:leading-7",
    long: "text-[15px] leading-6 sm:text-[15.5px] sm:leading-6",
  },
};

const LIST_CLASSES: Record<PromptSize, string> = {
  lg: "mt-5 gap-2.5 text-[15px] leading-7 lg:text-base",
  md: "mt-4 gap-2.5 text-[14.5px] leading-7",
  sm: "mt-3 gap-2 text-[14px] leading-6",
};

/**
 * Renders a question prompt. Generated prompts vary wildly in length and often
 * carry an embedded list of items, so this owns the typography: enumerations
 * become real lists, and a long instruction steps down a size instead of
 * shouting at the student.
 */
export function PromptContent({
  prompt,
  size = "lg",
  headingLevel = 1,
  className,
}: {
  prompt: string;
  size?: PromptSize;
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const parsedPrompt = parseEnumeratedPrompt(prompt);
  const headingText = parsedPrompt?.instruction ?? prompt;
  const isLong = headingText.length > LONG_PROMPT_LENGTH;
  const headingClassName = cn(
    "max-w-3xl text-balance font-semibold tracking-[-0.02em] text-ink",
    isLong ? HEADING_CLASSES[size].long : HEADING_CLASSES[size].standard,
    className,
  );

  if (!parsedPrompt) return renderHeading(headingLevel, headingText, headingClassName);

  return (
    <div>
      {renderHeading(headingLevel, parsedPrompt.instruction, headingClassName)}
      <ol
        className={cn(
          "grid max-w-3xl pl-6 text-ink marker:font-semibold marker:text-ink-secondary",
          parsedPrompt.marker === "letter" ? "list-[lower-alpha]" : "list-decimal",
          LIST_CLASSES[size],
        )}
      >
        {parsedPrompt.items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

/** Numbered `1)` items first, then lettered `(a)` sub-requirements. */
export function parseEnumeratedPrompt(prompt: string): ParsedPrompt | null {
  return (
    parseNumberedPrompt(prompt) ??
    parseMarkedPrompt(
      prompt,
      LETTERED_ITEM_PATTERN,
      (marker, index) => marker === String.fromCharCode("a".charCodeAt(0) + index),
      "letter",
    )
  );
}

export function parseNumberedPrompt(prompt: string): ParsedPrompt | null {
  return parseMarkedPrompt(
    prompt,
    NUMBERED_ITEM_PATTERN,
    (marker, index) => Number(marker) === index + 1,
    "number",
  );
}

function parseMarkedPrompt(
  prompt: string,
  pattern: RegExp,
  isExpectedMarker: (marker: string, index: number) => boolean,
  marker: ParsedPrompt["marker"],
): ParsedPrompt | null {
  const matches = [...prompt.matchAll(pattern)];
  if (matches.length < MINIMUM_ITEMS || matches.length > MAXIMUM_ITEMS) return null;

  const isSequential = matches.every((match, index) =>
    isExpectedMarker(match[1] ?? "", index),
  );
  if (!isSequential) return null;

  const firstMatchIndex = matches[0]?.index;
  if (firstMatchIndex === undefined) return null;

  const instruction = prompt.slice(0, firstMatchIndex).trim();
  if (!instruction || !/[.!?:]$/.test(instruction)) return null;

  const items = matches.map((match, index) => {
    const itemStart = (match.index ?? 0) + match[0].length;
    const nextItemStart = matches[index + 1]?.index ?? prompt.length;
    return prompt.slice(itemStart, nextItemStart).trim().replace(/,$/, "");
  });
  if (items.some((item) => item.length < 2)) return null;

  return { instruction, items, marker };
}

function renderHeading(headingLevel: 1 | 2 | 3 | 4, children: string, className: string) {
  if (headingLevel === 4) return <h4 className={className}>{children}</h4>;
  if (headingLevel === 3) return <h3 className={className}>{children}</h3>;
  if (headingLevel === 2) return <h2 className={className}>{children}</h2>;
  return <h1 className={className}>{children}</h1>;
}
