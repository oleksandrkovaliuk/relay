import { Eye } from "lucide-react";

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
  select_cloze: {
    label: "Passage with choices",
    description: "A whole text with a dropdown at every gap. The hardest auto-graded type.",
  },
  error_fix: {
    label: "Fix the mistake",
    description: "One wrong phrase flagged in a sentence. Built from the student's own errors.",
  },
  proofread: {
    label: "Proofread a passage",
    description: "A short text with several wrong forms to correct in place.",
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
 * Lets the teacher guarantee that particular widgets appear. The generator still
 * mixes in other types around them, so a selection sharpens the set rather than
 * flattening it. Selecting nothing leaves the whole mix to the brief.
 *
 * Every card can also show a worked example in the student preview beside it: a
 * name and one line of description are not enough to picture what a widget asks
 * of a learner, and the choice is made before anything has been generated.
 */
export function ActivityTypePicker({
  selected,
  onChange,
  previewed,
  onPreview,
}: {
  selected: ActivityType[];
  onChange: (selected: ActivityType[]) => void;
  /** The type whose example is on screen, so its card can mark itself. */
  previewed: ActivityType | null;
  onPreview: (activityType: ActivityType) => void;
}) {
  function toggle(activityType: ActivityType, isSelected: boolean) {
    if (isSelected) {
      onChange(
        ACTIVITY_TYPES.filter(
          (candidate) => candidate === activityType || selected.includes(candidate),
        ),
      );
      return;
    }
    onChange(selected.filter((candidate) => candidate !== activityType));
  }

  return (
    <div>
      <div role="group" aria-label="Activity types" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIVITY_TYPES.map((activityType) => {
          const { label, description } = ACTIVITY_TYPE_DESCRIPTIONS[activityType];
          const isSelected = selected.includes(activityType);
          const isPreviewed = previewed === activityType;
          return (
            /* The example button sits under the label rather than inside it: a
               label may only wrap the control it names, and these cards are
               three to a row, so a button beside the text leaves the
               description one word wide. */
            <div
              key={activityType}
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-[background-color,border-color] duration-150",
                isSelected
                  ? "border-primary/45 bg-primary-soft/60"
                  : "border-border bg-card hover:border-input hover:bg-muted/40",
                isPreviewed && "ring-2 ring-ring/35",
              )}
            >
              <label className="flex cursor-pointer items-start gap-2.5">
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
              <button
                type="button"
                aria-pressed={isPreviewed}
                aria-label={`Show an example ${label.toLowerCase()} activity`}
                onClick={() => onPreview(activityType)}
                className={cn(
                  /* Left edge of the text lines up with the description above it. */
                  "ml-5 mt-1 flex min-h-7 items-center gap-1 rounded-lg px-1.5 text-[12px] font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  isPreviewed ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye size={13} aria-hidden />
                Example
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
        {selected.length === 0
          ? "Nothing selected — Claude picks the mix that fits the brief."
          : `${selected.length === 1 ? "This type is" : "These types are"} guaranteed to appear, mixed with others.`}
      </p>
    </div>
  );
}

export { ACTIVITY_TYPE_DESCRIPTIONS };
