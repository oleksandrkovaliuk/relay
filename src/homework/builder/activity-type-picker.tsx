import { Eye } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_ITEM_PLANS,
  DEFAULT_ACTIVITY_ITEM_COUNT,
  MAXIMUM_ACTIVITY_ITEM_COUNT,
  MAXIMUM_PLANNED_ITEMS,
  MINIMUM_ACTIVITY_ITEM_COUNT,
  countPlannedActivities,
  countPlannedItems,
  estimatePlanMinutes,
  type ActivityPlanEntry,
  type ActivityType,
} from "@/shared/claude";

type ActivityTypeDescription = {
  label: string;
  description: string;
};

/** Teacher-facing names for each generated widget, in a sensible teaching order. */
const ACTIVITY_TYPE_DESCRIPTIONS: Record<ActivityType, ActivityTypeDescription> = {
  multiple_choice: {
    label: "Multiple choice",
    description: "One or more correct options. Fast to answer, auto-graded.",
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
    description: "A question answered in the student's own words. You grade it.",
  },
  rewrite: {
    label: "Sentence rewrite",
    description: "Correct or transform a given sentence. You grade it.",
  },
};

/**
 * What the homework is made of, decided by the teacher rather than guessed at
 * generation time: which widgets appear, and how much practice each one carries.
 *
 * A count is in practice items — sentences, questions, pairs, gaps — because
 * that is what a teacher counts. Ten multiple-choice sentences are ten
 * activities; ten cloze gaps are one passage. The card says which it will be, so
 * the number never means something different from what was typed.
 */
export function ActivityTypePicker({
  plan,
  onChange,
  previewed,
  onPreview,
}: {
  plan: ActivityPlanEntry[];
  onChange: (plan: ActivityPlanEntry[]) => void;
  /** The type whose example is on screen, so its card can mark itself. */
  previewed: ActivityType | null;
  onPreview: (activityType: ActivityType) => void;
}) {
  function toggle(activityType: ActivityType, isSelected: boolean) {
    if (!isSelected) {
      onChange(plan.filter((entry) => entry.type !== activityType));
      return;
    }
    const selected = new Map(plan.map((entry) => [entry.type, entry]));
    selected.set(activityType, {
      type: activityType,
      itemCount: DEFAULT_ACTIVITY_ITEM_COUNT,
    });
    // Kept in the canonical teaching order, which is also the section order the
    // student meets them in.
    onChange(
      ACTIVITY_TYPES.flatMap((candidate) => {
        const entry = selected.get(candidate);
        return entry ? [entry] : [];
      }),
    );
  }

  const isOverBudget = countPlannedItems(plan) > MAXIMUM_PLANNED_ITEMS;

  function setItemCount(activityType: ActivityType, itemCount: number) {
    onChange(
      plan.map((entry) => (entry.type === activityType ? { ...entry, itemCount } : entry)),
    );
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Activity types"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {ACTIVITY_TYPES.map((activityType) => {
          const { label, description } = ACTIVITY_TYPE_DESCRIPTIONS[activityType];
          const entry = plan.find((candidate) => candidate.type === activityType);
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
                entry
                  ? "border-primary/45 bg-primary-soft/60"
                  : "border-border bg-card hover:border-input hover:bg-muted/40",
                isPreviewed && "ring-2 ring-ring/35",
              )}
            >
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={Boolean(entry)}
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

              {entry ? (
                <ItemCountField
                  activityType={activityType}
                  itemCount={entry.itemCount}
                  onItemCountChange={(itemCount) => setItemCount(activityType, itemCount)}
                />
              ) : null}

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
      <p
        className={cn(
          "mt-2 text-[12px] leading-5",
          isOverBudget ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {plan.length === 0
          ? "Choose at least one activity type. Nothing outside your selection is generated."
          : isOverBudget
            ? `${countPlannedItems(plan)} practice items is more than one homework can hold. Bring it down to ${MAXIMUM_PLANNED_ITEMS} or fewer, or split it into two sets.`
            : `${countPlannedItems(plan)} practice items · ${countPlannedActivities(plan)} activities · about ${estimatePlanMinutes(plan)} minutes.`}
      </p>
    </div>
  );
}

/**
 * How many items of this type. The line under the field says what the number
 * turns into for this widget, because "10" means ten screens for a
 * one-sentence type and one passage for a cloze.
 */
function ItemCountField({
  activityType,
  itemCount,
  onItemCountChange,
}: {
  activityType: ActivityType;
  itemCount: number;
  onItemCountChange: (itemCount: number) => void;
}) {
  const { itemsPerActivity, itemNoun } = ACTIVITY_TYPE_ITEM_PLANS[activityType];
  const activityCount = Math.ceil(itemCount / itemsPerActivity);
  const inputId = `activity-count-${activityType}`;

  return (
    <div className="ml-5 mt-2">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-[12px] font-medium text-foreground">
          {itemNoun === "question" ? "Questions" : `${itemNoun[0]?.toUpperCase()}${itemNoun.slice(1)}s`}
        </label>
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={MINIMUM_ACTIVITY_ITEM_COUNT}
          max={MAXIMUM_ACTIVITY_ITEM_COUNT}
          value={itemCount}
          onChange={(event) =>
            onItemCountChange(
              clampItemCount(event.target.valueAsNumber || DEFAULT_ACTIVITY_ITEM_COUNT),
            )
          }
          className="h-8 w-16 px-2 text-[13px] numeric"
        />
      </div>
      <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
        {itemsPerActivity === 1
          ? `${activityCount} separate ${activityCount === 1 ? "activity" : "activities"}`
          : `${activityCount} ${activityCount === 1 ? "activity" : "activities"}, up to ${itemsPerActivity} ${itemNoun}s each`}
      </p>
    </div>
  );
}

function clampItemCount(value: number) {
  return Math.min(
    MAXIMUM_ACTIVITY_ITEM_COUNT,
    Math.max(MINIMUM_ACTIVITY_ITEM_COUNT, Math.round(value)),
  );
}

export { ACTIVITY_TYPE_DESCRIPTIONS };
