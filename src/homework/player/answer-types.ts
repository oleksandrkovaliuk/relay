export type PublicQuestionContent =
  | {
      kind: "multiple_choice";
      choices: string[];
      /** How many options are right; never which. */
      correctChoiceCount: number;
    }
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
  | { kind: "choices"; choiceIndices: number[] }
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

export type QuestionSection<Question> = {
  /** Stable across renders: the player keys its per-section state on this. */
  key: string;
  title: string;
  task: string;
  questions: Question[];
  /** 1-based position of the section's first activity in the whole worksheet. */
  firstActivityNumber: number;
};

/**
 * The worksheet as the student now works through it: one screen per section,
 * every activity of that section on it.
 *
 * A generated set names its sections, so consecutive activities sharing a
 * `set.title` are one screen. Homework written before sections existed has no
 * titles at all, and putting all of it on one screen would be a wall — there the
 * activity type stands in, which reproduces the old one-activity-per-step shape
 * for a mixed set.
 */
export function groupQuestionsIntoSections<
  Question extends { set?: QuestionSet; type: string },
>(questions: Question[]): QuestionSection<Question>[] {
  const sections: (QuestionSection<Question> & { groupKey: string })[] = [];
  questions.forEach((question, index) => {
    const groupKey = question.set?.title
      ? `set:${question.set.title}`
      : `type:${question.type}`;
    const current = sections.at(-1);
    if (current && current.groupKey === groupKey) {
      current.questions.push(question);
      return;
    }
    sections.push({
      groupKey,
      key: `${groupKey}#${index}`,
      title: question.set?.title ?? humanizeQuestionType(question.type),
      task: question.set?.task ?? question.set?.title ?? "",
      questions: [question],
      firstActivityNumber: index + 1,
    });
  });
  return sections.map(({ groupKey: _groupKey, ...section }) => section);
}

function humanizeQuestionType(type: string) {
  const words = type.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Sentinel for a gap the student has not answered yet. */
export const UNSELECTED_OPTION = -1;

export function emptyResponse(content: PublicQuestionContent): AnswerResponse {
  switch (content.kind) {
    case "multiple_choice":
      return { kind: "choices", choiceIndices: [] };
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

/**
 * Whether this answer is finished. Multiple choice needs the activity's own
 * content to say so: picking one of the two right answers is a started answer,
 * not a done one, and the progress rail was calling it done.
 */
export function isAnswerComplete(response: AnswerResponse, content?: PublicQuestionContent) {
  switch (response.kind) {
    case "choice":
      return response.choiceIndex >= 0;
    case "choices": {
      const requiredCount =
        content?.kind === "multiple_choice" ? content.correctChoiceCount : 1;
      return response.choiceIndices.length >= requiredCount;
    }
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
    case "choices":
      return response.choiceIndices.length > 0;
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
  /** Multiple choice: every option that was expected. */
  correctChoiceIndices?: number[];
  /** A single typed answer: error_fix and open_response. */
  expected?: string | null;
  /**
   * False while the student is still working: a section check tells them which
   * of their own answers are wrong and nothing else, so no widget may show the
   * expected answer or point at an option that was not picked.
   */
  revealsAnswers?: boolean;
  /** The activity's own verdict, for widgets marked as a whole. */
  verdict?: "correct" | "partial" | "incorrect";
};

/**
 * Turns a graded answer into what each widget needs to draw it marked. Shared by
 * the student's review and the teacher's, because a marked answer must look the
 * same to both — the teacher was reading unmarked widgets before this, which
 * left a wrong answer drawn in the same green as a right one.
 */
export function toWidgetMarking(answer: {
  content: { kind: string };
  parts: { isCorrect: boolean; expected: string }[];
  correctness?: string;
  correctAnswer: string | null;
}): WidgetMarking {
  const parts = answer.parts.map((part) => ({
    isCorrect: part.isCorrect,
    expected: part.expected,
  }));
  if (answer.content.kind === "multiple_choice") {
    return {
      parts,
      correctChoiceIndices: answer.parts.flatMap((part, index) =>
        part.expected === "Select" ? [index] : [],
      ),
    };
  }
  if (parts.length === 0) {
    // One typed answer: error_fix and the written tasks.
    return {
      parts: [
        { isCorrect: answer.correctness === "correct", expected: answer.correctAnswer ?? "" },
      ],
      expected: answer.correctAnswer,
    };
  }
  return { parts };
}
