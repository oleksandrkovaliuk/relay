import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn, initials } from "@/lib/utils";

export interface StudentPickerOption {
  _id: Id<"students">;
  name: string;
  email?: string;
}

/**
 * Assigning one homework to several students. Chips carry a face and a name so
 * the assignment list is readable at a glance, the list marks who is already on
 * it, and "Everyone" exists because assigning a whole small class one by one is
 * the common case.
 */
export function StudentMultiPicker({
  students,
  value,
  onValueChange,
  disabled = false,
  compact = false,
}: {
  students: StudentPickerOption[];
  value: Id<"students">[];
  onValueChange: (studentIds: Id<"students">[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const anchorRef = useComboboxAnchor();
  const selectedStudents = value.flatMap((studentId) => {
    const student = students.find((candidate) => candidate._id === studentId);
    return student ? [student] : [];
  });
  const isEveryoneSelected =
    students.length > 0 && selectedStudents.length === students.length;

  return (
    <div className="grid gap-2">
      <Combobox
        multiple
        items={students.map((student) => student._id)}
        value={value}
        onValueChange={onValueChange}
        itemToStringLabel={(studentId) =>
          students.find((student) => student._id === studentId)?.name ?? "Student"
        }
      >
        <ComboboxChips
          ref={anchorRef}
          className={cn(
            "min-h-11 items-start gap-1.5 rounded-xl border-border bg-card px-2 py-1.5",
            compact && "min-h-9 max-w-[24rem] py-1",
          )}
        >
          {selectedStudents.map((student) => (
            <ComboboxChip
              key={student._id}
              className="h-7 gap-1.5 rounded-full bg-primary-soft pl-1 pr-1 text-[12.5px] text-primary"
            >
              <StudentAvatar name={student.name} tone="chip" />
              {student.name}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            disabled={disabled}
            aria-label="Assign students"
            className="min-h-7 min-w-24 px-1 text-[13px]"
            placeholder={
              selectedStudents.length === 0 ? "Search students to assign…" : "Add another…"
            }
          />
        </ComboboxChips>

        <ComboboxContent anchor={anchorRef} className="max-h-72">
          <ComboboxEmpty>No student by that name.</ComboboxEmpty>
          <ComboboxList>
            {students.map((student) => (
              <ComboboxItem
                key={student._id}
                value={student._id}
                className="min-h-11 gap-2.5 px-2.5"
              >
                <StudentAvatar name={student.name} tone="list" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{student.name}</span>
                  {student.email ? (
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {student.email}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {students.length > 1 ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12.5px]"
            disabled={disabled || isEveryoneSelected}
            onClick={() => onValueChange(students.map((student) => student._id))}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={13} strokeWidth={2} aria-hidden />
            Everyone ({students.length})
          </Button>
          {selectedStudents.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12.5px] text-muted-foreground"
              disabled={disabled}
              onClick={() => onValueChange([])}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StudentAvatar({ name, tone }: { name: string; tone: "chip" | "list" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        tone === "chip"
          ? "size-5 bg-primary/15 text-[8.5px] text-primary"
          : "size-7 bg-muted text-[10px] text-secondary-foreground",
      )}
    >
      {initials(name)}
    </span>
  );
}
