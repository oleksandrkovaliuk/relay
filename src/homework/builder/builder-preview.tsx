import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import {
  emptyResponse,
  type PublicQuestionContent,
} from "@/homework/player/answer-types";
import { HomeworkWizard } from "@/homework/player/homework-wizard";
import { PromptContent } from "@/homework/player/prompt-content";
import { QuestionWidget } from "@/homework/player/question-widgets";
import {
  ACTIVITY_TYPE_ITEM_PLANS,
  describeActivityPlan,
  estimatePlanMinutes,
  type ActivityPlanEntry,
  type ActivityType,
} from "@/shared/claude";

import { ACTIVITY_TYPE_DESCRIPTIONS } from "./activity-type-picker";
import { ACTIVITY_TYPE_SAMPLES, ACTIVITY_TYPE_SECTION_TASKS } from "./activity-type-samples";

const MAXIMUM_VISIBLE_SKILLS = 3;
/** Enough of a section to read as a run of activities without becoming the set. */
const MAXIMUM_PREVIEWED_ACTIVITIES = 3;

type PreviewActivityData = {
  key: string;
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
};

type PreviewSection = {
  activityType: ActivityType;
  title: string;
  task: string;
  /** The mock activities drawn on screen. */
  activities: PreviewActivityData[];
  /** How many activities the real section will hold. */
  activityCount: number;
  itemCount: number;
  itemNoun: string;
  /** True for a type being examined that is not in the homework yet. */
  isExample: boolean;
};

/**
 * The homework as it is being described, redrawn on every keystroke: one section
 * per chosen activity type, filled with worked examples of that widget in the
 * real player frame. A teacher picking "10 fill the blanks" is otherwise picking
 * from a name and a number, and the shape of what they ordered only becomes
 * visible after a generation they have already waited for.
 */
export function BuilderPreview({
  studentName,
  lessonNotes,
  targetSkills,
  activityPlan,
  difficulty,
  isGenerating,
  previewedActivityType,
  onPreviewActivityType,
}: {
  studentName: string | null;
  lessonNotes: string;
  targetSkills: string;
  activityPlan: ActivityPlanEntry[];
  difficulty: string;
  isGenerating: boolean;
  /** A type the teacher asked to see, whether or not it is in the plan. */
  previewedActivityType: ActivityType | null;
  onPreviewActivityType: (activityType: ActivityType | null) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const skills = parseSkills(targetSkills);
  const sections = useMemo(
    () => buildPreviewSections(activityPlan, previewedActivityType),
    [activityPlan, previewedActivityType],
  );
  const [sectionIndex, setSectionIndex] = useState(0);

  useEffect(function followTheTypeThatWasAskedFor() {
    if (!previewedActivityType) return;
    const requestedIndex = sections.findIndex(
      (section) => section.activityType === previewedActivityType,
    );
    if (requestedIndex >= 0) setSectionIndex(requestedIndex);
    // The picker sits in the other column on a wide screen and above this panel
    // on a narrow one, where an example nobody scrolls to has not been shown.
    panelRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [previewedActivityType, sections]);

  useEffect(function stayInsideTheSetAsItChanges() {
    setSectionIndex((current) => Math.min(current, Math.max(0, sections.length - 1)));
  }, [sections.length]);

  const section = sections[Math.min(sectionIndex, sections.length - 1)];

  return (
    <aside
      ref={panelRef}
      className="min-w-0 2xl:sticky 2xl:top-[calc(var(--page-header-height)+1rem)] 2xl:self-start"
    >
      <SectionHeading
        title="Student preview"
        description={
          section?.isExample
            ? "A worked example of this activity type, in the wizard your student uses."
            : "The shape of the homework you are describing, in the wizard your student uses."
        }
        action={
          previewedActivityType ? (
            <Button variant="ghost" size="sm" onClick={() => onPreviewActivityType(null)}>
              <X size={14} aria-hidden /> Close example
            </Button>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {isGenerating ? "Generating…" : "Live"}
            </span>
          )
        }
        className="mb-3"
      />

      {section ? (
        <HomeworkWizard
          currentStep={sectionIndex + 1}
          totalSteps={sections.length}
          stepNoun="Section"
          answeredSteps={sections.map(() => false)}
          onSelectStep={(step) => setSectionIndex(step - 1)}
          eyebrow={
            section.isExample
              ? "Example · not in this homework"
              : `${section.activityCount} ${section.activityCount === 1 ? "activity" : "activities"} · ${section.itemCount} ${section.itemNoun}${section.itemCount === 1 ? "" : "s"}`
          }
          meta={
            <span className="numeric">
              {activityPlan.length > 0 ? `${estimatePlanMinutes(activityPlan)} min · ` : ""}
              <span className="capitalize">{difficulty}</span>
            </span>
          }
          prompt={
            <h3 className="mt-2.5 max-w-3xl text-balance text-[24px] font-semibold leading-snug tracking-[-0.03em] xl:text-[27px]">
              {section.title}
            </h3>
          }
          instructions={section.task}
          className="min-h-[38rem]"
          supplement={
            <PreviewFootnote
              section={section}
              studentName={studentName}
              skills={skills}
              hasLessonNotes={lessonNotes.trim().length > 0}
            />
          }
          back={
            <Button
              variant="ghost"
              size="xl"
              disabled={sectionIndex === 0}
              onClick={() => setSectionIndex((current) => Math.max(0, current - 1))}
            >
              Previous section
            </Button>
          }
          next={
            <Button
              size="xl"
              disabled={sectionIndex >= sections.length - 1}
              onClick={() =>
                setSectionIndex((current) => Math.min(sections.length - 1, current + 1))
              }
            >
              Next section
            </Button>
          }
        >
          <ol className="grid gap-7">
            {section.activities.map((activity, index) => (
              <PreviewActivity
                key={activity.key}
                number={index + 1}
                prompt={activity.prompt}
                instructions={activity.instructions}
                content={activity.content}
              />
            ))}
          </ol>
        </HomeworkWizard>
      ) : (
        <EmptyPreview />
      )}

      <p className="mt-3 text-pretty text-[13px] leading-5 text-muted-foreground">
        {section?.isExample
          ? "Examples run on a sample lesson, and are answerable — your own activities are written from the brief."
          : "Sample activities on a sample lesson. Yours are written from the brief, and you review every one before publishing."}
      </p>
    </aside>
  );
}

/** One mock activity, drawn exactly as the student will meet it in a section. */
function PreviewActivity({
  number,
  prompt,
  instructions,
  content,
}: {
  number: number;
  prompt: string;
  instructions: string;
  content: PublicQuestionContent;
}) {
  const [response, setResponse] = useState(() => emptyResponse(content));

  useEffect(function resetWhenTheExampleChanges() {
    setResponse(emptyResponse(content));
  }, [content]);

  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
      <span className="mt-0.5 font-mono text-[12.5px] text-muted-foreground numeric">
        {number}.
      </span>
      <div className="min-w-0">
        <PromptContent prompt={prompt} size="sm" />
        {instructions ? (
          <p className="mt-1 text-pretty text-[12.5px] leading-5 text-muted-foreground">
            {instructions}
          </p>
        ) : null}
        <div className="mt-3">
          <QuestionWidget content={content} response={response} onChange={setResponse} />
        </div>
      </div>
    </li>
  );
}

/** What the section will really contain, and what the brief adds to it. */
function PreviewFootnote({
  section,
  studentName,
  skills,
  hasLessonNotes,
}: {
  section: PreviewSection;
  studentName: string | null;
  skills: string[];
  hasLessonNotes: boolean;
}) {
  const hiddenActivityCount = section.activityCount - section.activities.length;
  const hasLargerRealActivities =
    !section.isExample && ACTIVITY_TYPE_ITEM_PLANS[section.activityType].itemsPerActivity > 1;
  const visibleSkills = skills.slice(0, MAXIMUM_VISIBLE_SKILLS);
  const remainingSkillCount = Math.max(0, skills.length - visibleSkills.length);

  return (
    <div className="mt-7 grid gap-2 rounded-xl border border-dashed border-border bg-muted/35 px-4 py-3.5">
      {hiddenActivityCount > 0 ? (
        <p className="text-[12.5px] leading-5 text-secondary-foreground numeric">
          + {hiddenActivityCount} more{" "}
          {hiddenActivityCount === 1 ? "activity" : "activities"} like these in this section.
        </p>
      ) : /* An example that carries many items at once is shown at sample size,
          so the count that was asked for still has to be said. */
      hasLargerRealActivities ? (
        <p className="text-[12.5px] leading-5 text-secondary-foreground numeric">
          Yours will carry {section.itemCount} {section.itemNoun}
          {section.itemCount === 1 ? "" : "s"} here.
        </p>
      ) : null}
      <p className="text-pretty text-[12.5px] leading-5 text-muted-foreground">
        {section.isExample
          ? "Tick this type to add it to the homework."
          : studentName
            ? `Written around ${studentName}'s saved context and recent results${
                hasLessonNotes ? ", plus your lesson brief" : ""
              }.`
            : hasLessonNotes
              ? "Written from your lesson brief."
              : "Add a lesson brief, or pick a student, to give these activities their content."}
        {visibleSkills.length > 0
          ? ` Focus: ${visibleSkills.join(", ")}${remainingSkillCount > 0 ? ` + ${remainingSkillCount} more` : ""}.`
          : ""}
      </p>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="panel grid min-h-[24rem] place-items-center px-8 py-12 text-center">
      <div className="max-w-sm">
        <p className="text-[15px] font-medium text-foreground">
          Choose an activity type to see the homework.
        </p>
        <p className="mt-2 text-pretty text-[13px] leading-5 text-muted-foreground">
          Every type you tick becomes one section your student works through, and it
          appears here as you go.
        </p>
      </div>
    </div>
  );
}

/**
 * The plan as sections, in order. A type being examined that is not in the plan
 * is shown on its own — that is what the picker's Example button is for, and a
 * teacher deciding whether to tick it has nothing else to look at.
 */
function buildPreviewSections(
  activityPlan: ActivityPlanEntry[],
  previewedActivityType: ActivityType | null,
): PreviewSection[] {
  const planned = describeActivityPlan(activityPlan).map((entry) =>
    toPreviewSection(entry.type, entry.itemCount, entry.activityCount, false),
  );
  const isPreviewedTypePlanned = activityPlan.some(
    (entry) => entry.type === previewedActivityType,
  );
  if (!previewedActivityType || isPreviewedTypePlanned) return planned;

  const { itemsPerActivity } = ACTIVITY_TYPE_ITEM_PLANS[previewedActivityType];
  return [
    toPreviewSection(previewedActivityType, itemsPerActivity, 1, true),
    ...planned,
  ];
}

function toPreviewSection(
  activityType: ActivityType,
  itemCount: number,
  activityCount: number,
  isExample: boolean,
): PreviewSection {
  const visibleCount = Math.min(activityCount, MAXIMUM_PREVIEWED_ACTIVITIES);
  const samples = ACTIVITY_TYPE_SAMPLES[activityType];
  return {
    activityType,
    title: ACTIVITY_TYPE_DESCRIPTIONS[activityType].label,
    task: ACTIVITY_TYPE_SECTION_TASKS[activityType],
    activityCount,
    itemCount,
    itemNoun: ACTIVITY_TYPE_ITEM_PLANS[activityType].itemNoun,
    isExample,
    activities: Array.from({ length: visibleCount }, (_, index) => {
      const sample = samples[index % samples.length] ?? samples[0]!;
      return {
        key: `${activityType}-${index}`,
        prompt: sample.prompt,
        instructions: sample.instructions,
        content: sample.content,
      };
    }),
  };
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}
