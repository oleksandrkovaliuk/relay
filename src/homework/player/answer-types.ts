export type PublicQuestionContent =
  | { kind: "multiple_choice"; choices: string[] }
  | { kind: "fill_blank"; text: string; blankCount: number }
  | { kind: "matching"; lefts: string[]; rights: string[] }
  | { kind: "open_response" };

export type AnswerResponse =
  | { kind: "choice"; choiceIndex: number }
  | { kind: "blanks"; values: string[] }
  | { kind: "matches"; rights: string[] }
  | { kind: "text"; text: string };

export interface PlayerQuestion {
  _id: string;
  order: number;
  type: string;
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
  points: number;
  difficulty: string;
}

export function emptyResponse(content: PublicQuestionContent): AnswerResponse {
  switch (content.kind) {
    case "multiple_choice":
      return { kind: "choice", choiceIndex: -1 };
    case "fill_blank":
      return { kind: "blanks", values: Array.from({ length: content.blankCount }, () => "") };
    case "matching":
      return { kind: "matches", rights: content.lefts.map(() => "") };
    case "open_response":
      return { kind: "text", text: "" };
  }
}

export function isAnswerComplete(response: AnswerResponse) {
  switch (response.kind) {
    case "choice":
      return response.choiceIndex >= 0;
    case "blanks":
      return response.values.every((value) => value.trim().length > 0);
    case "matches":
      return response.rights.every((right) => right.length > 0);
    case "text":
      return response.text.trim().length > 0;
  }
}

const BLANK_MARKER = /\{\{(\d+)\}\}/g;

export interface TextSegment {
  text: string;
  blankIndex: number | null;
}

/**
 * Splits `He {{1}} already {{2}}` into literal text and blank placeholders so the
 * player can render real inputs inside the sentence instead of one big text box.
 */
export function splitBlankText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let seenBlanks = 0;
  for (const match of text.matchAll(BLANK_MARKER)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex), blankIndex: null });
    }
    segments.push({ text: match[0], blankIndex: seenBlanks });
    seenBlanks += 1;
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), blankIndex: null });
  }
  return segments;
}
