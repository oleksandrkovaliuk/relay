import type { FunctionReturnType } from "convex/server";

import type { api } from "@convex/_generated/api";
import { EvilBarChart } from "@/components/charts/recharts-bar-chart";
import type { ChartConfig } from "@/components/charts/recharts-chart";
import { cn } from "@/lib/utils";

/**
 * Its own module so the page can load it after painting: Recharts is by far the
 * largest thing on Insights and the chart sits below the fold.
 */
type DailySubmissions = FunctionReturnType<typeof api.dashboard.overview>["daily"];

const SUBMISSION_CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: -16 };

const CHART_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const SUBMISSION_CHART_CONFIG = {
  submitted: {
    label: "Submitted",
    colors: {
      light: ["var(--chart-4)"],
      dark: ["var(--chart-2)"],
    },
  },
} satisfies ChartConfig;

export default function SubmissionChart({
  dailySubmissions,
}: {
  dailySubmissions: DailySubmissions;
}) {
  const hasSparseHistory = dailySubmissions.length < 3;

  return (
    <div className={cn(hasSparseHistory ? "h-44 lg:h-48" : "h-64 lg:h-72")}>
      <EvilBarChart
        animationType="none"
        chartProps={{ margin: SUBMISSION_CHART_MARGIN }}
        className="h-full aspect-auto"
        config={SUBMISSION_CHART_CONFIG}
        data={dailySubmissions}
        barCategoryGap={8}
        barRadius={5}
      >
        <EvilBarChart.Grid
          stroke="var(--border)"
          strokeDasharray="2 4"
          strokeOpacity={0.8}
          vertical={false}
        />
        <EvilBarChart.XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-sans)", fontSize: 12 }}
          tickFormatter={formatChartDate}
        />
        <EvilBarChart.YAxis
          allowDecimals={false}
          tick={{ fontFamily: "var(--font-sans)", fontSize: 12 }}
          width={28}
        />
        <EvilBarChart.Tooltip roundness="xl" variant="frosted-glass" />
        <EvilBarChart.Bar dataKey="submitted" radius={5} barProps={{ maxBarSize: 30 }} />
      </EvilBarChart>
    </div>
  );
}

function formatChartDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return CHART_DATE_FORMATTER.format(date);
}
