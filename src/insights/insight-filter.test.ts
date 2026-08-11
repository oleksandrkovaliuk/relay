import { describe, expect, it } from "vitest";

import {
  describeInsightScope,
  isInsightFilterActive,
  parseInsightsSearch,
  resolveInsightFilter,
  resolveRangePreset,
  toDayValue,
} from "./insight-filter";

const NOON_ON_11_AUGUST = new Date(2026, 7, 11, 12, 0, 0).getTime();
const START_OF_11_AUGUST = new Date(2026, 7, 11, 0, 0, 0, 0).getTime();
const END_OF_11_AUGUST = new Date(2026, 7, 11, 23, 59, 59, 999).getTime();

describe("parseInsightsSearch", () => {
  it("keeps recognisable values and drops the rest", () => {
    expect(
      parseInsightsSearch({
        student: "abc123",
        from: "2026-08-01",
        to: "not-a-date",
        range: "7d",
        section: "skills",
        rogue: "drop me",
      }),
    ).toEqual({ student: "abc123", from: "2026-08-01", range: "7d", section: "skills" });
  });

  it("drops an unknown range or section rather than trusting it", () => {
    expect(parseInsightsSearch({ range: "forever", section: "wat" })).toEqual({});
  });
});

describe("resolveInsightFilter", () => {
  it("returns an unbounded window for all time", () => {
    expect(resolveInsightFilter({}, NOON_ON_11_AUGUST)).toEqual({});
  });

  it("covers the whole of the teacher's own day for today", () => {
    expect(resolveInsightFilter({ range: "today" }, NOON_ON_11_AUGUST)).toEqual({
      from: START_OF_11_AUGUST,
      to: END_OF_11_AUGUST,
    });
  });

  it("counts the last 7 days inclusive of today", () => {
    const filter = resolveInsightFilter({ range: "7d" }, NOON_ON_11_AUGUST);
    expect(filter.from).toBe(new Date(2026, 7, 5, 0, 0, 0, 0).getTime());
    expect(filter.to).toBe(END_OF_11_AUGUST);
  });

  it("starts this month on the first", () => {
    expect(resolveInsightFilter({ range: "month" }, NOON_ON_11_AUGUST).from).toBe(
      new Date(2026, 7, 1, 0, 0, 0, 0).getTime(),
    );
  });

  it("treats a single custom day as that whole day", () => {
    expect(
      resolveInsightFilter({ from: "2026-08-11", to: "2026-08-11" }, NOON_ON_11_AUGUST),
    ).toEqual({ from: START_OF_11_AUGUST, to: END_OF_11_AUGUST });
  });

  it("carries the student through every range", () => {
    expect(resolveInsightFilter({ student: "abc", range: "today" }, NOON_ON_11_AUGUST)).toMatchObject(
      { studentId: "abc" },
    );
  });
});

describe("filter description", () => {
  it("infers a custom range from bare dates", () => {
    expect(resolveRangePreset({ from: "2026-08-01" })).toBe("custom");
    expect(resolveRangePreset({})).toBe("all");
  });

  it("names who and when", () => {
    expect(describeInsightScope({ range: "7d" }, "Mira Petrova")).toBe(
      "Mira Petrova · last 7 days",
    );
    expect(describeInsightScope({}, null)).toBe("All students · all time");
  });

  it("knows when anything is filtered", () => {
    expect(isInsightFilterActive({})).toBe(false);
    expect(isInsightFilterActive({ student: "abc" })).toBe(true);
    expect(isInsightFilterActive({ range: "month" })).toBe(true);
  });
});

describe("toDayValue", () => {
  it("formats a timestamp as the local calendar day", () => {
    expect(toDayValue(NOON_ON_11_AUGUST)).toBe("2026-08-11");
  });
});
