import { useQuery } from "convex-helpers/react/cache";
import { X } from "lucide-react";

import { api } from "@convex/_generated/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn, initials } from "@/lib/utils";
import {
  RANGE_PRESET_LABELS,
  isInsightFilterActive,
  resolveRangePreset,
  toDayValue,
  type InsightRangePreset,
  type InsightsSearch,
} from "./insight-filter";

const RANGE_ORDER: InsightRangePreset[] = ["all", "today", "7d", "30d", "month", "custom"];
/** Past this many, names stop fitting on one line and a select reads better. */
const MAXIMUM_STUDENT_CHIPS = 5;

/**
 * The one control over everything below it: whose work, and which days. Both
 * questions are answered in a single click on a visible option rather than
 * inside a dropdown — the current answer is then readable without opening
 * anything. Every change is written to the URL, so the view is shareable and the
 * back button walks through the questions the teacher asked.
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
  const isFiltered = isInsightFilterActive(search);

  function changeRange(nextRange: InsightRangePreset) {
    if (nextRange === "custom") {
      onChange({ ...search, range: "custom", from: search.from ?? today, to: search.to ?? today });
      return;
    }
    const { from: _from, to: _to, ...rest } = search;
    onChange({ ...rest, range: nextRange });
  }

  function changeStudent(studentId: string | null) {
    const { student: _student, ...rest } = search;
    onChange(studentId ? { ...rest, student: studentId } : rest);
  }

  const visibleStudents = students ?? [];
  const isChipLayout = visibleStudents.length <= MAXIMUM_STUDENT_CHIPS;

  return (
    <div className="panel grid gap-2.5 px-4 py-3.5 xl:px-5">
      <FilterRow label="Student">
        {isChipLayout ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip isSelected={!search.student} onSelect={() => changeStudent(null)}>
              All students
            </FilterChip>
            {visibleStudents.map((student) => (
              <FilterChip
                key={student._id}
                isSelected={search.student === student._id}
                onSelect={() => changeStudent(student._id)}
              >
                <Avatar size="sm" aria-hidden className="size-4">
                  <AvatarFallback className="bg-transparent text-[8.5px] font-semibold">
                    {initials(student.name)}
                  </AvatarFallback>
                </Avatar>
                {student.name}
              </FilterChip>
            ))}
          </div>
        ) : (
          <NativeSelect
            size="sm"
            className="w-52"
            value={search.student ?? ""}
            aria-label="Filter insights by student"
            onChange={(event) => changeStudent(event.target.value || null)}
          >
            <NativeSelectOption value="">All students</NativeSelectOption>
            {visibleStudents.map((student) => (
              <NativeSelectOption key={student._id} value={student._id}>
                {student.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FilterRow>

      <FilterRow label="Period">
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGE_ORDER.map((preset) => (
            <FilterChip
              key={preset}
              isSelected={range === preset}
              onSelect={() => changeRange(preset)}
            >
              {RANGE_PRESET_LABELS[preset]}
            </FilterChip>
          ))}

          {range === "custom" ? (
            <span className="ml-1 flex items-center gap-1.5 rounded-full border border-border bg-card px-1.5 py-1">
              <DayInput
                label="Start date"
                value={search.from ?? ""}
                max={search.to ?? today}
                onChange={(from) => onChange({ ...search, range: "custom", from })}
              />
              <span aria-hidden className="text-[12px] text-muted-foreground">
                to
              </span>
              <DayInput
                label="End date"
                value={search.to ?? ""}
                min={search.from}
                onChange={(to) => onChange({ ...search, range: "custom", to })}
              />
            </span>
          ) : null}

          {isFiltered ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={() => onChange(search.section ? { section: search.section } : {})}
            >
              <X size={13} aria-hidden /> Clear
            </Button>
          ) : null}
        </div>
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="w-14 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** One answer to the row's question, pressed or not. */
function FilterChip({
  isSelected,
  onSelect,
  children,
}: {
  isSelected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium outline-none transition-[background-color,border-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-primary/45 bg-primary-soft text-primary"
          : "border-border bg-card text-secondary-foreground hover:border-input hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
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
      className="h-6 rounded-full bg-transparent px-1.5 text-[12.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
