import type { Id } from "@convex/_generated/dataModel";

/**
 * Insights answers one question at a time: whose work, and over what window.
 * The filter lives in the URL so a view can be linked to — Today's "View all"
 * buttons are just links that arrive with a filter already applied.
 */
export type InsightSection = "highlights" | "skills" | "students" | "questions";

export type InsightsSearch = {
  student?: string;
  /** Inclusive calendar day, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  range?: InsightRangePreset;
  section?: InsightSection;
};

export type InsightRangePreset = "all" | "today" | "7d" | "30d" | "month" | "custom";

export type InsightFilter = {
  studentId?: Id<"students">;
  from?: number;
  to?: number;
};

export const INSIGHT_SECTIONS: InsightSection[] = [
  "highlights",
  "skills",
  "students",
  "questions",
];

const RANGE_PRESETS: InsightRangePreset[] = ["all", "today", "7d", "30d", "month", "custom"];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

export const RANGE_PRESET_LABELS: Record<InsightRangePreset, string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  custom: "Custom range",
};

/** URL search params are untrusted input: keep only what is recognisable. */
export function parseInsightsSearch(search: Record<string, unknown>): InsightsSearch {
  const range = asRangePreset(search.range);
  const section = asSection(search.section);
  return {
    ...(typeof search.student === "string" && search.student ? { student: search.student } : {}),
    ...(asDay(search.from) ? { from: asDay(search.from) } : {}),
    ...(asDay(search.to) ? { to: asDay(search.to) } : {}),
    ...(range ? { range } : {}),
    ...(section ? { section } : {}),
  };
}

/**
 * Turns the URL's calendar days into the timestamp window the queries take.
 * `now` is passed in rather than read here so the window follows the clock the
 * rest of the page is using.
 */
export function resolveInsightFilter(search: InsightsSearch, now: number): InsightFilter {
  const studentId = search.student ? (search.student as Id<"students">) : undefined;
  const range = search.range ?? (search.from || search.to ? "custom" : "all");

  if (range === "custom") {
    const from = search.from ? startOfDay(parseDay(search.from)) : undefined;
    const to = search.to ? endOfDay(parseDay(search.to)) : undefined;
    return withStudent(studentId, { from, to });
  }
  if (range === "today") {
    return withStudent(studentId, { from: startOfDay(now), to: endOfDay(now) });
  }
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    return withStudent(studentId, {
      // Inclusive of today, so "last 7 days" is a week ending tonight.
      from: startOfDay(now - (days - 1) * MILLISECONDS_PER_DAY),
      to: endOfDay(now),
    });
  }
  if (range === "month") {
    const start = new Date(now);
    start.setDate(1);
    return withStudent(studentId, { from: startOfDay(start.getTime()), to: endOfDay(now) });
  }
  return withStudent(studentId, {});
}

/** Which preset a search is showing, so the control can reflect the URL. */
export function resolveRangePreset(search: InsightsSearch): InsightRangePreset {
  return search.range ?? (search.from || search.to ? "custom" : "all");
}

export function describeInsightScope(search: InsightsSearch, studentName: string | null) {
  const range = resolveRangePreset(search);
  const window =
    range === "custom"
      ? describeCustomWindow(search)
      : RANGE_PRESET_LABELS[range].toLocaleLowerCase();
  return `${studentName ?? "All students"} · ${window}`;
}

export function isInsightFilterActive(search: InsightsSearch) {
  return Boolean(search.student) || resolveRangePreset(search) !== "all";
}

/** The `YYYY-MM-DD` a `<input type="date">` needs for a timestamp. */
export function toDayValue(timestamp: number) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function describeCustomWindow(search: InsightsSearch) {
  if (search.from && search.to) {
    return search.from === search.to
      ? formatDay(search.from)
      : `${formatDay(search.from)} – ${formatDay(search.to)}`;
  }
  if (search.from) return `from ${formatDay(search.from)}`;
  if (search.to) return `until ${formatDay(search.to)}`;
  return "all time";
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(
    parseDay(day),
  );
}

function withStudent(studentId: Id<"students"> | undefined, window: Omit<InsightFilter, "studentId">) {
  return {
    ...(studentId ? { studentId } : {}),
    ...(window.from === undefined ? {} : { from: window.from }),
    ...(window.to === undefined ? {} : { to: window.to }),
  };
}

/** Local midnight, so a day means the teacher's day rather than UTC's. */
function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1).getTime();
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function asDay(value: unknown) {
  return typeof value === "string" && DAY_PATTERN.test(value) ? value : undefined;
}

function asRangePreset(value: unknown) {
  return RANGE_PRESETS.find((preset) => preset === value);
}

function asSection(value: unknown) {
  return INSIGHT_SECTIONS.find((section) => section === value);
}
