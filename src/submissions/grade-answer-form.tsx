import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useState, type FormEvent } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Submission = NonNullable<ReturnType<typeof useQuery<typeof api.submissions.detail>>>;
type AnswerDetail = Submission["answers"][number];

const GRADE_OPTIONS = [
  { value: "correct", label: "Correct" },
  { value: "partial", label: "Partly right" },
  { value: "incorrect", label: "Incorrect" },
] as const;

type TeacherGradeCorrectness = (typeof GRADE_OPTIONS)[number]["value"];

/**
 * The one decision only a teacher can make: what a written answer was worth.
 * Auto-graded activities never reach this, so it appears exactly where a verdict
 * is missing — and says what saving it does, because the student's score stays
 * incomplete until it is.
 */
export function GradeAnswerForm({
  answer,
  submissionId,
}: {
  answer: AnswerDetail;
  submissionId: Id<"submissions">;
}) {
  const gradePendingAnswer = useMutation(api.submissions.gradePendingAnswer);
  const [correctness, setCorrectness] = useState<TeacherGradeCorrectness>("correct");
  const [pointsText, setPointsText] = useState(String(answer.points));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointsAwarded = Number(pointsText);
  const hasValidPoints =
    pointsText.trim().length > 0 &&
    Number.isInteger(pointsAwarded) &&
    pointsAwarded >= 0 &&
    pointsAwarded <= answer.points;
  const hasConsistentGrade =
    (correctness === "correct" && pointsAwarded === answer.points) ||
    (correctness === "incorrect" && pointsAwarded === 0) ||
    (correctness === "partial" && pointsAwarded > 0 && pointsAwarded < answer.points);
  const canSave = hasValidPoints && hasConsistentGrade && !isSaving;
  const pointsInputId = `grade-points-${answer.questionId}`;

  function selectCorrectness(nextCorrectness: TeacherGradeCorrectness) {
    setCorrectness(nextCorrectness);
    setError(null);
    // The points follow the verdict, so the common cases need no typing at all.
    if (nextCorrectness === "correct") {
      setPointsText(String(answer.points));
      return;
    }
    if (nextCorrectness === "incorrect") {
      setPointsText("0");
      return;
    }
    setPointsText(String(Math.max(1, Math.floor(answer.points / 2))));
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await gradePendingAnswer({
        submissionId,
        questionId: answer.questionId,
        correctness,
        pointsAwarded,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this grade.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="mt-4 max-w-2xl rounded-xl border border-primary/25 bg-primary-soft/40 px-4 py-3.5"
      onSubmit={(event) => void saveGrade(event)}
    >
      <fieldset>
        <legend className="text-[12.5px] font-semibold text-foreground">
          Your grade completes this score
        </legend>
        <div
          className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/80 p-1"
          aria-label="Answer result"
        >
          {GRADE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={correctness === option.value ? "default" : "ghost"}
              className="min-w-0 px-2"
              aria-pressed={correctness === option.value}
              disabled={isSaving || (option.value === "partial" && answer.points < 2)}
              onClick={() => selectCorrectness(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          htmlFor={pointsInputId}
          className={cn(
            "flex items-center gap-2 text-[12.5px] font-medium text-foreground",
            correctness !== "partial" && "text-muted-foreground",
          )}
        >
          Points
          <input
            id={pointsInputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={answer.points}
            step={1}
            value={pointsText}
            disabled={correctness !== "partial" || isSaving}
            onChange={(event) => setPointsText(event.target.value)}
            className="h-8 w-16 rounded-xl border border-transparent bg-input/50 px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:bg-muted disabled:text-secondary-foreground"
          />
          <span className="text-muted-foreground numeric">of {answer.points}</span>
        </label>
        <Button type="submit" size="sm" className="ml-auto" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save grade"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2.5 text-[12.5px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
