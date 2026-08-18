import { useQuery } from "convex-helpers/react/cache";
import { X } from "lucide-react";

import { api } from "@convex/_generated/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
const ALL_STUDENTS_VALUE = "all";
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
  const selectedStudentName =
    visibleStudents.find((student) => student._id === search.student)?.name ?? "All students";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/70 pb-3">
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
          <Select
            value={search.student ?? ALL_STUDENTS_VALUE}
            onValueChange={(value) =>
              changeStudent(value === ALL_STUDENTS_VALUE ? null : value)
            }
          >
            <SelectTrigger
              size="sm"
              className="w-44 rounded-md bg-muted/70 text-[12.5px]"
              aria-label="Filter insights by student"
            >
              <SelectValue>{selectedStudentName}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={ALL_STUDENTS_VALUE}>All students</SelectItem>
              {visibleStudents.map((student) => (
                <SelectItem key={student._id} value={student._id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FilterRow>

      <span className="hidden h-4 w-px bg-border/80 lg:block" aria-hidden />

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
            <span className="ml-1 flex items-center gap-1 rounded-md bg-muted/70 px-1 py-0.5">
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/75">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
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
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 text-[12.5px] font-medium outline-none transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-muted/65 hover:text-foreground",
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
      className="h-6 rounded bg-transparent px-1.5 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
