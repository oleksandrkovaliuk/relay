import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import type { QuestionContent } from "./content";

interface SeedQuestion {
  type: string;
  prompt: string;
  instructions: string;
  content: QuestionContent;
  skillTags: string[];
  points: number;
  difficulty: string;
  explanation: string;
}

const SEED_QUESTIONS: SeedQuestion[] = [
  {
    type: "multiple_choice",
    prompt: "You reached the station at 9:15. The train went at 9:00. Which sentence is correct?",
    instructions: "Pick the sentence with the correct past tenses.",
    content: {
      kind: "multiple_choice",
      choices: [
        "By the time we got to the station, the train had already left.",
        "By the time we got to the station, the train already left.",
        "By the time we had got to the station, the train has already left.",
      ],
      correctChoice: 0,
    },
    skillTags: ["past-perfect", "sequencing"],
    points: 3,
    difficulty: "easy",
    explanation:
      "The earlier action takes past perfect (had left) and the later one takes past simple (got).",
  },
  {
    type: "fill_blank",
    prompt: "Complete the traveller's story with the missing articles.",
    instructions: "Type one small word (a, an or the) in each gap.",
    content: {
      kind: "fill_blank",
      text: "We ran to {{1}} platform, but {{2}} train had already gone. We waited for {{3}} next one.",
      blanks: [
        { acceptedAnswers: ["the"] },
        { acceptedAnswers: ["the"] },
        { acceptedAnswers: ["the"] },
      ],
    },
    skillTags: ["articles"],
    points: 3,
    difficulty: "medium",
    explanation: "Use 'the' when both speakers know which specific thing is meant.",
  },
  {
    type: "matching",
    prompt: "Match each travel word to its meaning.",
    instructions: "Pair every word on the left with the correct definition.",
    content: {
      kind: "matching",
      pairs: [
        { left: "platform", right: "the raised area beside the track" },
        { left: "delayed", right: "later than the planned time" },
        { left: "luggage", right: "the bags you carry when you travel" },
      ],
    },
    skillTags: ["travel-vocabulary"],
    points: 3,
    difficulty: "easy",
    explanation: "These are the three words from today's lesson.",
  },
  {
    type: "rewrite",
    prompt:
      "Join each pair into ONE sentence showing which happened first.\n1. We arrived at the station. Earlier, the train left platform 3.\n2. She got to the baggage hall. Earlier, someone took her luggage.",
    instructions: "Write two sentences, using 'when' or 'by the time' plus the past perfect.",
    content: {
      kind: "open_response",
      expectedAnswer:
        "1. By the time we arrived at the station, the train had already left platform 3.\n2. When she got to the baggage hall, someone had taken her luggage.",
    },
    skillTags: ["sentence-combining", "past-perfect"],
    points: 4,
    difficulty: "hard",
    explanation: "Only the earlier action moves to had + past participle.",
  },
];

export const demoHomework = internalMutation({
  args: { shareToken: v.string(), ownerId: v.optional(v.id("users")) },
  returns: v.object({ shareToken: v.string(), studentId: v.id("students") }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      ownerId: args.ownerId,
      name: "Mira Petrova",
      email: "mira@example.com",
      miroBoardUrl: "https://miro.com/app/board/demo-mira/",
      contextNotes:
        "B1 learner preparing for a work trip. Drops articles before singular nouns and confuses past simple with past perfect. Motivated by travel topics.",
      status: "active",
      createdAt: now,
    });

    const aiJobId = await ctx.db.insert("aiJobs", {
      ownerId: args.ownerId,
      requestId: `seed-${args.shareToken}`,
      kind: "homework_generation",
      status: "running",
      studentId,
      title: "Travel stories: past perfect & articles",
      inputSnapshot: "{}",
      provider: "claude_code",
      createdAt: now,
    });

    const homeworkDraftId = await ctx.db.insert("homeworkDrafts", {
      ownerId: args.ownerId,
      aiJobId,
      studentId,
      title: "Travel stories: past perfect & articles",
      summary:
        "A short mixed-format review set targeting Mira's two recurring errors while recycling this lesson's travel vocabulary.",
      estimatedMinutes: 10,
      learningObjectives: [
        "Choose past perfect for the earlier of two past events",
        "Supply the missing article before singular travel nouns",
        "Use platform, delayed and luggage accurately",
      ],
      status: "review_required",
      createdAt: now,
    });
    await ctx.db.patch("aiJobs", aiJobId, { status: "completed", completedAt: now });

    const assignmentId = await ctx.db.insert("assignments", {
      ownerId: args.ownerId,
      homeworkDraftId,
      studentId,
      title: "Travel stories: past perfect & articles",
      summary:
        "A short mixed-format review set targeting Mira's two recurring errors while recycling this lesson's travel vocabulary.",
      estimatedMinutes: 10,
      learningObjectives: [
        "Choose past perfect for the earlier of two past events",
        "Supply the missing article before singular travel nouns",
        "Use platform, delayed and luggage accurately",
      ],
      shareToken: args.shareToken,
      status: "published",
      publishedAt: now,
    });
    await ctx.db.insert("assignmentStudents", {
      ownerId: args.ownerId,
      assignmentId,
      studentId,
      createdAt: now,
    });

    for (const [order, question] of SEED_QUESTIONS.entries()) {
      await ctx.db.insert("homeworkQuestions", {
        ownerId: args.ownerId,
        homeworkDraftId,
        order,
        ...question,
      });
      await ctx.db.insert("assignmentQuestions", {
        ownerId: args.ownerId,
        assignmentId,
        order,
        ...question,
      });
    }

    return { shareToken: args.shareToken, studentId };
  },
});
