import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, type ActivityType } from "@/shared/claude";

type ActivityTypeDescription = {
  label: string;
  description: string;
};

/** Teacher-facing names for each generated widget, in a sensible teaching order. */
const ACTIVITY_TYPE_DESCRIPTIONS: Record<ActivityType, ActivityTypeDescription> = {
  multiple_choice: {
    label: "Multiple choice",
    description: "One correct option from four. Fast to answer, auto-graded.",
  },
  fill_blank: {
    label: "Fill the blanks",
    description: "Gaps inside a sentence or short text. Accepts spelling variants.",
  },
  matching: {
    label: "Matching pairs",
    description: "Click a prompt, then its match. Good for form and meaning.",
  },
  short_answer: {
    label: "Short answer",
    description: "A sentence or two in the student's own words. You grade it.",
  },
  rewrite: {
    label: "Sentence rewrite",
    description: "Correct or transform given sentences. You grade it.",
  },
};

/**
 * Lets the teacher pin the homework to particular widgets. Selecting nothing
 * is the useful default: the generator then picks the mix from the brief.
 */
export function ActivityTypePicker({
  selected,
  onChange,
}: {
  selected: ActivityType[];
  onChange: (selected: ActivityType[]) => void;
}) {
  function toggle(activityType: ActivityType, isSelected: boolean) {
    if (isSelected) {
      onChange(ACTIVITY_TYPES.filter((candidate) => candidate === activityType || selected.includes(candidate)));
      return;
    }
    onChange(selected.filter((candidate) => candidate !== activityType));
  }

  return (
    <div>
      <div role="group" aria-label="Activity types" className="grid gap-2 sm:grid-cols-2">
        {ACTIVITY_TYPES.map((activityType) => {
          const { label, description } = ACTIVITY_TYPE_DESCRIPTIONS[activityType];
          const isSelected = selected.includes(activityType);
          return (
            <label
              key={activityType}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-[background-color,border-color] duration-150",
                isSelected
                  ? "border-primary/45 bg-primary-soft/60"
                  : "border-border bg-card hover:border-input hover:bg-muted/40",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(nextChecked) => toggle(activityType, nextChecked)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block text-pretty text-[12px] leading-[17px] text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
        {selected.length === 0
          ? "Nothing selected — Claude will choose the mix that fits the brief."
          : `Only ${selected.length === 1 ? "this type" : "these types"} will be generated.`}
      </p>
    </div>
  );
}

export { ACTIVITY_TYPE_DESCRIPTIONS };
