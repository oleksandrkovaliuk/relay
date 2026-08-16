export type PublicQuestionContent =
  | { kind: "multiple_choice"; choices: string[] }
  | {
      kind: "fill_blank";
      text: string;
      blankCount: number;
      /** One entry per blank; `null` where the blank has no bracketed source word. */
      hints: (string | null)[];
    }
  | { kind: "matching"; lefts: string[]; rights: string[] }
  | { kind: "select_cloze"; text: string; gaps: { options: string[] }[] }
  /** A sentence with one wrong phrase flagged; the student retypes that phrase. */
  | { kind: "error_fix"; before: string; flagged: string; after: string }
  /** A passage with several wrong forms in it, corrected one marker at a time. */
  | { kind: "proofread"; text: string; errors: { flagged: string }[] }
  | { kind: "open_response" };

export type AnswerResponse =
  | { kind: "choice"; choiceIndex: number }
  | { kind: "blanks"; values: string[] }
  | { kind: "matches"; rights: string[] }
  | { kind: "selections"; selectedOptions: number[] }
  | { kind: "text"; text: string };

/** The named set an activity belongs to, mirroring a worksheet's sections. */
export type QuestionSet = {
  title: string;
  task: string;
};

export type PlayerQuestion = {
  _id: string;
  order: number;
  type: string;
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
  points: number;
  difficulty: string;
  set?: QuestionSet;
};

/**
 * Sets in the order they appear, with the steps that belong to each. Consecutive
 * activities sharing a title are one set, so a repeated title later in the sheet
 * starts a new one rather than merging into the earlier section.
 */
export function groupQuestionsIntoSets<Question extends { set?: QuestionSet }>(
  questions: Question[],
) {
  const sets: { title: string; task: string; questions: Question[]; firstStep: number }[] = [];
  questions.forEach((question, index) => {
    const title = question.set?.title ?? "";
    const current = sets.at(-1);
    if (current && current.title === title) {
      current.questions.push(question);
      return;
    }
    sets.push({
      title,
      task: question.set?.task ?? "",
      questions: [question],
      firstStep: index + 1,
    });
  });
  return sets;
}

/** Sentinel for a gap the student has not answered yet. */
export const UNSELECTED_OPTION = -1;

export function emptyResponse(content: PublicQuestionContent): AnswerResponse {
  switch (content.kind) {
    case "multiple_choice":
      return { kind: "choice", choiceIndex: -1 };
    case "fill_blank":
      return { kind: "blanks", values: Array.from({ length: content.blankCount }, () => "") };
    case "matching":
      return { kind: "matches", rights: content.lefts.map(() => "") };
    case "select_cloze":
      return {
        kind: "selections",
        selectedOptions: content.gaps.map(() => UNSELECTED_OPTION),
      };
    case "proofread":
      // One typed correction per flagged form, marked the way blanks are.
      return { kind: "blanks", values: content.errors.map(() => "") };
    case "error_fix":
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
    case "selections":
      return response.selectedOptions.every((option) => option >= 0);
    case "text":
      return response.text.trim().length > 0;
  }
}

/**
 * Whether the student has put anything at all into the answer. A skipped step
 * has nothing worth sending, while a half-finished one still deserves saving.
 */
export function hasAnyAnswer(response: AnswerResponse) {
  switch (response.kind) {
    case "choice":
      return response.choiceIndex >= 0;
    case "blanks":
      return response.values.some((value) => value.trim().length > 0);
    case "matches":
      return response.rights.some((right) => right.length > 0);
    case "selections":
      return response.selectedOptions.some((option) => option >= 0);
    case "text":
      return response.text.trim().length > 0;
  }
}

const BLANK_MARKER = /\{\{(\d+)\}\}/g;

export type TextSegment = {
  text: string;
  blankIndex: number | null;
};

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

/**
 * A marked answer, per part, in the same order the widget renders. The review
 * shows the student's own attempt inside the real activity rather than a text
 * dump of it, so every widget needs to know which of its parts went wrong and
 * what was expected there.
 */
export type WidgetMarking = {
  parts: { isCorrect: boolean; expected: string }[];
  /** Multiple choice: which option was right. */
  correctChoiceIndex?: number;
  /** A single typed answer: error_fix and open_response. */
  expected?: string | null;
};
