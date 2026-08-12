import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  RANGE_PRESET_LABELS,
  isInsightFilterActive,
  resolveRangePreset,
  toDayValue,
  type InsightRangePreset,
  type InsightsSearch,
} from "./insight-filter";

const RANGE_ORDER: InsightRangePreset[] = ["all", "today", "7d", "30d", "month", "custom"];

/**
 * The one control over everything below it: whose work, and which days. Every
 * change is written to the URL, so the view is shareable and the back button
 * walks through the questions the teacher asked.
 */
export function InsightsFilterBar({
  search,
  now,
  onChange,
}: {
  search: InsightsSearch;
  now: number;
  onChange: (next: InsightsSearch) => void;
}) {
  const students = useQuery(api.students.list);
  const range = resolveRangePreset(search);
  const today = toDayValue(now);

  function changeRange(nextRange: InsightRangePreset) {
    if (nextRange === "custom") {
      onChange({ ...search, range: "custom", from: search.from ?? today, to: search.to ?? today });
      return;
    }
    const { from: _from, to: _to, ...rest } = search;
    onChange({ ...rest, range: nextRange });
  }

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <FilterField label="Student">
        <NativeSelect
          size="sm"
          value={search.student ?? ""}
          aria-label="Filter insights by student"
          onChange={(event) => {
            const { student: _student, ...rest } = search;
            onChange(
              event.target.value ? { ...rest, student: event.target.value } : rest,
            );
          }}
        >
          <NativeSelectOption value="">All students</NativeSelectOption>
          {(students ?? []).map((student) => (
            <NativeSelectOption key={student._id} value={student._id}>
              {student.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FilterField>

      <FilterField label="Period">
        <NativeSelect
          size="sm"
          value={range}
          aria-label="Filter insights by period"
          onChange={(event) => changeRange(event.target.value as InsightRangePreset)}
        >
          {RANGE_ORDER.map((preset) => (
            <NativeSelectOption key={preset} value={preset}>
              {RANGE_PRESET_LABELS[preset]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FilterField>

      {range === "custom" ? (
        <>
          <FilterField label="From" className="w-auto">
            <DayInput
              label="Start date"
              value={search.from ?? ""}
              max={search.to ?? today}
              onChange={(from) => onChange({ ...search, range: "custom", from })}
            />
          </FilterField>
          <FilterField label="To" className="w-auto">
            <DayInput
              label="End date"
              value={search.to ?? ""}
              min={search.from}
              onChange={(to) => onChange({ ...search, range: "custom", to })}
            />
          </FilterField>
        </>
      ) : null}

      {isInsightFilterActive(search) ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => onChange(search.section ? { section: search.section } : {})}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid w-40 gap-1", className)}>
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DayInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-xl border border-border bg-card px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
    />
  );
}
