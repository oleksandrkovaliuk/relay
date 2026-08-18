import { describe, expect, it } from "vitest";

import {
  activityPlanSchema,
  countPlannedActivities,
  countPlannedItems,
  describeActivityPlan,
  estimatePlanMinutes,
  generateHomeworkInputSchema,
} from "./claude";

describe("describeActivityPlan", () => {
  it("turns items into one activity each for the one-sentence widgets", () => {
    expect(describeActivityPlan([{ type: "multiple_choice", itemCount: 10 }])).toEqual([
      {
        type: "multiple_choice",
        itemCount: 10,
        itemsPerActivity: 1,
        itemNoun: "question",
        activityCount: 10,
      },
    ]);
  });

  it("packs items into as few passages as the widget allows", () => {
    const [cloze] = describeActivityPlan([{ type: "select_cloze", itemCount: 10 }]);

    // Ten gaps are two passages, not ten one-gap texts.
    expect(cloze?.activityCount).toBe(2);
    expect(cloze?.itemNoun).toBe("gap");
  });

  it("counts the whole worksheet the way the teacher asked for it", () => {
    const plan = [
      { type: "multiple_choice" as const, itemCount: 10 },
      { type: "proofread" as const, itemCount: 12 },
    ];

    expect(countPlannedItems(plan)).toBe(22);
    expect(countPlannedActivities(plan)).toBe(12);
    expect(estimatePlanMinutes(plan)).toBeGreaterThan(5);
  });
});

describe("activityPlanSchema", () => {
  it("refuses an empty plan, because the teacher now chooses the activity types", () => {
    expect(activityPlanSchema.safeParse([]).success).toBe(false);
  });

  it("refuses the same type twice", () => {
    const duplicated = activityPlanSchema.safeParse([
      { type: "fill_blank", itemCount: 10 },
      { type: "fill_blank", itemCount: 4 },
    ]);

    expect(duplicated.success).toBe(false);
  });
});

describe("generateHomeworkInputSchema", () => {
  it("will not start a generation with nothing to generate", () => {
    const parsed = generateHomeworkInputSchema.safeParse({
      requestId: "request-1",
      lessonNotes: "Past perfect",
      targetSkills: [],
      difficulty: "intermediate",
      activityPlan: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a brief whose only source is the student's Miro board", () => {
    const parsed = generateHomeworkInputSchema.safeParse({
      requestId: "request-2",
      lessonNotes: "",
      miroBoardUrl: "https://miro.com/app/board/abc/",
      targetSkills: [],
      difficulty: "intermediate",
      activityPlan: [{ type: "short_answer", itemCount: 10 }],
    });

    expect(parsed.success).toBe(true);
  });
});
