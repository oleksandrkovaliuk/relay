import type { PublicQuestionContent } from "@/homework/player/answer-types";
import type { ActivityType } from "@/shared/claude";

export type ActivityTypeSample = {
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
  points: number;
};

/**
 * One worked example per widget, written the way a generated activity is written
 * and rendered through the real player. A teacher choosing activity types is
 * otherwise choosing from names alone — "Passage with choices" says nothing about
 * how much work it asks of a student, and the difference only shows on screen.
 *
 * They all practise the same past-perfect travel story, so stepping between them
 * compares the widgets rather than the topics.
 */
export const ACTIVITY_TYPE_SAMPLES: Record<ActivityType, ActivityTypeSample> = {
  multiple_choice: {
    prompt: "Which sentence puts the two events in the right order?",
    instructions: "Choose one option.",
    points: 2,
    content: {
      kind: "multiple_choice",
      choices: [
        "When we arrived, the train had already left.",
        "When we arrived, the train already left.",
        "When we had arrived, the train left.",
        "When we arrived, the train has already left.",
      ],
    },
  },
  fill_blank: {
    prompt: "Complete the story about a missed connection.",
    instructions:
      "Type one verb in each gap, in the form the sentence needs. Contractions are accepted.",
    points: 4,
    content: {
      kind: "fill_blank",
      text: "By the time I {{1}} the platform, the train {{2}} without me.",
      blankCount: 2,
      hints: ["reach", "leave"],
    },
  },
  matching: {
    prompt: "Match each opening with the ending that keeps the order of events clear.",
    instructions: "Choose the ending that belongs to each opening.",
    points: 3,
    content: {
      kind: "matching",
      lefts: [
        "I missed the train because",
        "After the train had left,",
        "By the time the guard came round,",
      ],
      rights: [
        "I bought a coffee and waited.",
        "I had arrived ten minutes late.",
        "the platform was empty.",
      ],
    },
  },
  select_cloze: {
    prompt: "Read the whole paragraph before you choose.",
    instructions: "Pick the form that fits at every gap.",
    points: 6,
    content: {
      kind: "select_cloze",
      text: "I {{1}} to the station in a hurry, but the train {{2}} five minutes earlier. Nobody {{3}} me that the timetable had changed.",
      gaps: [
        { options: ["ran", "had run", "have run"] },
        { options: ["had gone", "has gone", "goes"] },
        { options: ["had told", "has told", "tells"] },
      ],
    },
  },
  error_fix: {
    prompt: "Correct the highlighted phrase.",
    instructions: "Type the corrected phrase only. Contractions are accepted.",
    points: 3,
    content: {
      kind: "error_fix",
      before: "When I got to the platform, ",
      flagged: "the train already left",
      after: ", so I waited an hour for the next one.",
    },
  },
  proofread: {
    prompt: "This travel diary has four wrong verb forms.",
    instructions:
      "Retype each struck-through form correctly. Everything else in the text is right.",
    points: 8,
    content: {
      kind: "proofread",
      text: "Last summer I {{1}} to Lisbon for a week. By the time I arrived, my friend {{2}} the city for three days already. On my second day I {{3}} my wallet, so we {{4}} to the police station before dinner.",
      errors: [
        { flagged: "have gone" },
        { flagged: "explores" },
        { flagged: "have lost" },
        { flagged: "goed" },
      ],
    },
  },
  short_answer: {
    prompt:
      "Write 40-60 words about a time you arrived somewhere and found that something had already happened.",
    instructions:
      "Write one connected paragraph. Use at least two past perfect verbs, and keep the order of events clear.",
    points: 8,
    content: { kind: "open_response" },
  },
  rewrite: {
    prompt:
      "Join each pair into one sentence that makes the order clear. 1. I lost my ticket. Then I went to the ticket office. 2. The train left at 9:00. I got to the platform at 9:05.",
    instructions:
      "Use the past perfect for the earlier event and the past simple for the later one.",
    points: 6,
    content: { kind: "open_response" },
  },
};
