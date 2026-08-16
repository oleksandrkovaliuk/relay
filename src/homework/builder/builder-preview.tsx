import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { emptyResponse } from "@/homework/player/answer-types";
import { HomeworkWizard } from "@/homework/player/homework-wizard";
import { PromptContent } from "@/homework/player/prompt-content";
import { QuestionWidget } from "@/homework/player/question-widgets";
import { ACTIVITY_TYPES, type ActivityType } from "@/shared/claude";

import { ACTIVITY_TYPE_DESCRIPTIONS } from "./activity-type-picker";
import { ACTIVITY_TYPE_SAMPLES } from "./activity-type-samples";

const PLANNED_ACTIVITY_FLOW = ["Warm up", "Focused practice", "Use it yourself"];
const MAXIMUM_VISIBLE_SKILLS = 3;
const MAXIMUM_PREVIEW_SENTENCE_LENGTH = 150;

/**
 * A placeholder run of the real wizard, so the teacher sees the exact frame
 * their student will get before a single activity has been generated. Asking for
 * an activity type's example swaps the placeholder for a working one of that
 * widget, in the same frame.
 */
export function BuilderPreview({
  studentName,
  lessonNotes,
  targetSkills,
  durationMinutes,
  difficulty,
  isGenerating,
  previewedActivityType,
  onPreviewActivityType,
}: {
  studentName: string | null;
  lessonNotes: string;
  targetSkills: string;
  durationMinutes: number;
  difficulty: string;
  isGenerating: boolean;
  /** The activity type being demonstrated, or null for the brief's own preview. */
  previewedActivityType: ActivityType | null;
  onPreviewActivityType: (activityType: ActivityType | null) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const skills = parseSkills(targetSkills);
  const hasBrief = lessonNotes.trim().length > 0 || skills.length > 0;
  const previewTitle = skills[0] ? `${capitalize(skills[0])} practice` : "Lesson practice";
  const previewPrompt = lessonNotes.trim()
    ? firstSentence(lessonNotes)
    : "Your activity prompts will appear here once the brief is generated.";
  const visibleSkills = skills.slice(0, MAXIMUM_VISIBLE_SKILLS);
  const remainingSkillCount = Math.max(0, skills.length - visibleSkills.length);

  useEffect(function followTheExampleThatWasAskedFor() {
    if (!previewedActivityType) return;
    // The picker sits in the other column on a wide screen and above this panel
    // on a narrow one, where an example nobody scrolls to has not been shown.
    panelRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [previewedActivityType]);

  return (
    <aside
      ref={panelRef}
      className="min-w-0 2xl:sticky 2xl:top-[calc(var(--page-header-height)+1rem)] 2xl:self-start"
    >
      <SectionHeading
        title="Student preview"
        description={
          previewedActivityType
            ? "A worked example of this activity type, in the wizard your student uses."
            : "The exact wizard your student will work through."
        }
        action={
          previewedActivityType ? (
            <Button variant="ghost" size="sm" onClick={() => onPreviewActivityType(null)}>
              <X size={14} aria-hidden /> Close example
            </Button>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {isGenerating ? "Generating…" : "Before generation"}
            </span>
          )
        }
        className="mb-3"
      />

      {previewedActivityType ? (
        <ActivityTypeExample
          key={previewedActivityType}
          activityType={previewedActivityType}
          onActivityTypeChange={onPreviewActivityType}
        />
      ) : (
        <HomeworkWizard
          currentStep={1}
          totalSteps={PLANNED_ACTIVITY_FLOW.length}
          eyebrow={studentName ? `Prepared for ${studentName}` : "Independent practice"}
          meta={
            <span className="capitalize numeric">
              {durationMinutes} min · {difficulty}
            </span>
          }
          prompt={
            <h3 className="mt-2.5 max-w-3xl text-balance text-[24px] font-semibold leading-snug tracking-[-0.03em] xl:text-[27px]">
              {previewTitle}
            </h3>
          }
          instructions={previewPrompt}
        >
          {skills.length > 0 ? (
            <p className="text-pretty text-[13px] leading-5 text-muted-foreground xl:text-sm">
              <span className="font-medium text-foreground">Focus:</span> {visibleSkills.join(", ")}
              {remainingSkillCount > 0 ? ` + ${remainingSkillCount} more` : ""}
            </p>
          ) : null}

          <div className={skills.length > 0 ? "mt-6" : undefined}>
            <p className="text-[13px] font-medium text-foreground xl:text-sm">Activity flow</p>
            <ol className="mt-3 grid gap-2">
              {PLANNED_ACTIVITY_FLOW.map((label, index) => (
                <li
                  key={label}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 bg-muted/35 px-3.5"
                >
                  <span className="w-5 text-[12px] font-medium text-muted-foreground numeric">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] font-medium xl:text-[15px]">{label}</span>
                  <span className="ml-auto text-[12px] text-muted-foreground xl:text-[13px]">
                    {hasBrief ? "Planned" : "Preview"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </HomeworkWizard>
      )}

      <p className="mt-3 text-pretty text-[13px] leading-5 text-muted-foreground">
        {previewedActivityType
          ? "Examples run on a sample lesson, and are answerable — your own activities are written from the brief."
          : "You’ll review every prompt and answer key before publishing."}
      </p>
    </aside>
  );
}

/**
 * One activity type, answerable. The step rail walks the whole list, so a teacher
 * who opened one example can compare the rest without going back to the picker.
 */
function ActivityTypeExample({
  activityType,
  onActivityTypeChange,
}: {
  activityType: ActivityType;
  onActivityTypeChange: (activityType: ActivityType) => void;
}) {
  const sample = ACTIVITY_TYPE_SAMPLES[activityType];
  const [response, setResponse] = useState(() => emptyResponse(sample.content));
  const index = ACTIVITY_TYPES.indexOf(activityType);

  function showActivityTypeAt(nextIndex: number) {
    const nextActivityType = ACTIVITY_TYPES[nextIndex];
    if (nextActivityType) onActivityTypeChange(nextActivityType);
  }

  return (
    <HomeworkWizard
      currentStep={index + 1}
      totalSteps={ACTIVITY_TYPES.length}
      /* Nothing here is answered work, so the rail marks position only. */
      answeredSteps={ACTIVITY_TYPES.map(() => false)}
      onSelectStep={(step) => showActivityTypeAt(step - 1)}
      eyebrow={ACTIVITY_TYPE_DESCRIPTIONS[activityType].label}
      meta={<span className="numeric">Example · {sample.points} points</span>}
      prompt={
        <PromptContent prompt={sample.prompt} size="md" headingLevel={3} className="mt-2.5" />
      }
      instructions={sample.instructions}
      back={
        <Button
          variant="ghost"
          size="xl"
          disabled={index <= 0}
          onClick={() => showActivityTypeAt(index - 1)}
        >
          Previous type
        </Button>
      }
      next={
        <Button
          size="xl"
          disabled={index >= ACTIVITY_TYPES.length - 1}
          onClick={() => showActivityTypeAt(index + 1)}
        >
          Next type
        </Button>
      }
    >
      <QuestionWidget content={sample.content} response={response} onChange={setResponse} />
    </HomeworkWizard>
  );
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function firstSentence(value: string) {
  const [sentence] = value.trim().split(/(?<=[.!?])\s+/);
  if (!sentence) return "Your activity prompts will appear here after generation.";
  if (sentence.length <= MAXIMUM_PREVIEW_SENTENCE_LENGTH) return sentence;
  return `${sentence.slice(0, MAXIMUM_PREVIEW_SENTENCE_LENGTH - 3).trimEnd()}…`;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
