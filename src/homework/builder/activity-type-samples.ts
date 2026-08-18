import type { PublicQuestionContent } from "@/homework/player/answer-types";
import type { ActivityType } from "@/shared/claude";

export type ActivityTypeSample = {
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
  points: number;
};

/**
 * Worked examples per widget, written the way a generated activity is written
 * and rendered through the real player. A teacher choosing activity types is
 * otherwise choosing from names alone — "Passage with choices" says nothing about
 * how much work it asks of a student, and the difference only shows on screen.
 *
 * Several per type, because a section is now several activities of one kind: the
 * preview has to show what a run of them reads like, not one specimen. They all
 * practise the same past-perfect travel story, so stepping between types
 * compares the widgets rather than the topics.
 */
export const ACTIVITY_TYPE_SAMPLES: Record<ActivityType, ActivityTypeSample[]> = {
  multiple_choice: [
    {
      prompt: "The missed connection",
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
        correctChoiceCount: 1,
      },
    },
    {
      prompt: "The lost booking",
      instructions: "Choose one option.",
      points: 2,
      content: {
        kind: "multiple_choice",
        choices: [
          "The hotel had cancelled our room before we landed.",
          "The hotel has cancelled our room before we landed.",
          "The hotel cancelled our room before we had landed.",
        ],
        correctChoiceCount: 1,
      },
    },
    {
      prompt: "The late apology",
      instructions: "Choose one option.",
      points: 2,
      content: {
        kind: "multiple_choice",
        choices: [
          "By the time she called, we had waited for an hour.",
          "By the time she called, we have waited for an hour.",
          "By the time she had called, we waited for an hour.",
        ],
        correctChoiceCount: 1,
      },
    },
  ],
  fill_blank: [
    {
      prompt: "Sentence 1 · reaching the platform",
      instructions: "Type the verb in the form the sentence needs.",
      points: 2,
      content: {
        kind: "fill_blank",
        text: "By the time I {{1}} the platform, the train {{2}} without me.",
        blankCount: 2,
        hints: ["reach", "leave"],
      },
    },
    {
      prompt: "Sentence 2 · the empty carriage",
      instructions: "Type the verb in the form the sentence needs.",
      points: 2,
      content: {
        kind: "fill_blank",
        text: "Nobody {{1}} me that the timetable {{2}}.",
        blankCount: 2,
        hints: ["tell", "change"],
      },
    },
    {
      prompt: "Sentence 3 · the replacement bus",
      instructions: "Type the verb in the form the sentence needs.",
      points: 2,
      content: {
        kind: "fill_blank",
        text: "We {{1}} on the bus that the station staff {{2}} for us.",
        blankCount: 2,
        hints: ["get", "arrange"],
      },
    },
  ],
  matching: [
    {
      prompt: "Openings and endings",
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
    {
      prompt: "Words and meanings",
      instructions: "Pair every word with the meaning it carries.",
      points: 3,
      content: {
        kind: "matching",
        lefts: ["delayed", "layover", "platform"],
        rights: [
          "later than the planned time",
          "the raised area beside the track",
          "a wait between two connections",
        ],
      },
    },
  ],
  select_cloze: [
    {
      prompt: "A hurried morning",
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
    {
      prompt: "The hotel that had given the room away",
      instructions: "Pick the form that fits at every gap.",
      points: 6,
      content: {
        kind: "select_cloze",
        text: "When we {{1}}, the desk clerk explained that someone {{2}} our room. We {{3}} the booking twice that week.",
        gaps: [
          { options: ["arrived", "had arrived", "have arrived"] },
          { options: ["had taken", "has taken", "takes"] },
          { options: ["had confirmed", "have confirmed", "confirm"] },
        ],
      },
    },
  ],
  error_fix: [
    {
      prompt: "Sentence 1 · on the platform",
      instructions: "Type the corrected phrase only.",
      points: 3,
      content: {
        kind: "error_fix",
        before: "When I got to the platform, ",
        flagged: "the train already left",
        after: ", so I waited an hour for the next one.",
      },
    },
    {
      prompt: "Sentence 2 · at the hotel",
      instructions: "Type the corrected phrase only.",
      points: 3,
      content: {
        kind: "error_fix",
        before: "The room was gone because ",
        flagged: "we have booked it too late",
        after: ".",
      },
    },
    {
      prompt: "Sentence 3 · in the taxi",
      instructions: "Type the corrected phrase only.",
      points: 3,
      content: {
        kind: "error_fix",
        before: "I realised in the taxi that ",
        flagged: "I forgot my passport",
        after: " at the hotel.",
      },
    },
  ],
  proofread: [
    {
      prompt: "A travel diary with four wrong verb forms",
      instructions: "Retype each struck-through form correctly.",
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
  ],
  short_answer: [
    {
      prompt: "What had already happened when you arrived?",
      instructions: "Two or three sentences.",
      points: 4,
      content: { kind: "open_response" },
    },
    {
      prompt: "Why does the earlier event take the past perfect here?",
      instructions: "Answer in your own words.",
      points: 4,
      content: { kind: "open_response" },
    },
    {
      prompt: "Describe a journey where something went wrong before you set off.",
      instructions: "Two or three sentences, in order.",
      points: 4,
      content: { kind: "open_response" },
    },
  ],
  rewrite: [
    {
      prompt: "I lost my ticket. Then I went to the ticket office.",
      instructions: "Join the pair into one sentence that makes the order clear.",
      points: 3,
      content: { kind: "open_response" },
    },
    {
      prompt: "The train left at 9:00. I got to the platform at 9:05.",
      instructions: "Join the pair into one sentence that makes the order clear.",
      points: 3,
      content: { kind: "open_response" },
    },
    {
      prompt: "She booked the hotel. Later she cancelled the trip.",
      instructions: "Join the pair into one sentence that makes the order clear.",
      points: 3,
      content: { kind: "open_response" },
    },
  ],
};

/** The section task line shown above a type's activities in the preview. */
export const ACTIVITY_TYPE_SECTION_TASKS: Record<ActivityType, string> = {
  multiple_choice: "Choose the option that keeps the order of events clear.",
  fill_blank: "Put the verb in brackets into the form each sentence needs.",
  matching: "Pair every prompt on the left with the one that belongs to it.",
  select_cloze: "Read the whole passage, then choose the form at every gap.",
  error_fix: "One phrase in each sentence is wrong. Type the fixed version.",
  proofread: "Retype every struck-through form correctly.",
  short_answer: "Answer each question in your own words.",
  rewrite: "Rewrite each pair as one sentence.",
};
